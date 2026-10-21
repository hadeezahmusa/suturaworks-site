// QLV 2026 registration Worker.
//
// Public API used by suturaworks.com/qlv2026/ (CORS limited to the site),
// and the admin pages under /admin (see admin.js). Bindings: DB (D1) for
// records, KV for proof files, sign-in links and the dev outbox.

import { QBANK, SITUATIONS, MAX_ANSWER } from "../../qlv2026/questions.js";
import { CLOSES_AT, ADVISERS_CLOSE_AT, SPONSORED_MIN, SPONSORED_MAX, amountFor, closeLabel } from "../../qlv2026/event.js";
import { sniff, stripMetadata } from "./strip.js";
import * as mail from "./emails.js";
import { handleAdmin } from "./admin.js";
import { seatPending } from "./seating.js";

const MAX_PROOF = 5 * 1024 * 1024;
const MAX_JSON = 30000;
const SITS = new Set(SITUATIONS.map((s) => s.value));
const INVITERS = ["JCI Aso President", "Chairperson, Quality Leadership Value", "A corporate partner seat", "Someone else"];
const MODES = new Set(["both", "judge", "adviser"]);
const MAX_ANSWER_SETS = 10;

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------- small helpers, shared with admin.js ----------

export const now = () => new Date().toISOString();
export const isClosed = (at) => Date.now() >= Date.parse(at);

// When registration closes. Set from the admin page; the date in event.js
// is used until someone changes it.
export async function closesAt(env) {
  return (await env.KV.get("setting:closes_at")) || CLOSES_AT;
}

const ALPHABET = "abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
export function token(len = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export async function nextRef(env, counter) {
  const row = await env.DB.prepare("UPDATE counters SET n = n + 1 WHERE name = ? RETURNING n").bind(counter).first();
  const n = row.n;
  if (counter === "sponsored") return "QLV26-S" + String(n).padStart(2, "0");
  if (counter === "adviser") return "QLV26-A" + String(n).padStart(2, "0");
  if (counter === "partner") return "QLV26-P" + String(n).padStart(2, "0");
  if (counter === "facilitator") return "QLV26-F" + String(n).padStart(2, "0");
  return "QLV26-" + String(n).padStart(3, "0");
}

export function links(env, reg) {
  const site = env.SITE_URL;
  return {
    status: `${site}?ref=${encodeURIComponent(reg.ref)}&k=${encodeURIComponent(reg.secret)}`,
    claim: reg.claim_token ? `${site}?claim=${reg.claim_token}` : null,
    manage: reg.manage_token ? `${site}?sponsor=${reg.manage_token}` : null,
  };
}
export function ticketLinks(env, t) {
  return { ticket: `${env.SITE_URL}?ticket=${t.token}`, answer: `${env.SITE_URL}?answer=${t.token}` };
}

function clean(v, max = 160) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function need(value, label, check) {
  if (!value) throw new HttpError(400, `Please fill in ${label}.`);
  if (check === "email" && !EMAIL_RE.test(value)) throw new HttpError(400, `Please check ${label}. It does not look like a complete email address.`);
  if (check === "phone" && (!/^[+0-9 ()-]{7,20}$/.test(value) || value.replace(/\D/g, "").length < 7)) throw new HttpError(400, `Please check ${label}. It needs at least seven digits.`);
  return value;
}

async function readJson(req) {
  const text = await req.text();
  if (text.length > MAX_JSON) throw new HttpError(413, "That is more than we can accept in one go.");
  try { return JSON.parse(text); } catch { throw new HttpError(400, "We could not read that request."); }
}

// Crude abuse brake: at most `limit` actions of a kind per address per hour.
async function brake(env, req, kind, limit) {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const key = `rl:${kind}:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const n = Number(await env.KV.get(key)) || 0;
  if (n >= limit) throw new HttpError(429, "Too many attempts from this connection. Please wait an hour and try again, or email the registration team.");
  await env.KV.put(key, String(n + 1), { expirationTtl: 3700 });
}

// Sends through Resend. Without an API key (local testing) the message is
// kept in KV under outbox: so tests can read it.
export async function sendMail(env, msg, ref, kind) {
  let ok = false;
  let detail = "";
  try {
    if (env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: env.MAIL_FROM, to: [msg.to], reply_to: env.REPLY_TO,
          subject: msg.subject, html: msg.html, text: msg.text, attachments: msg.attachments,
        }),
      });
      detail = (await res.text()).slice(0, 300);
      ok = res.ok;
    } else {
      await env.KV.put(`outbox:${Date.now()}:${token(6)}`, JSON.stringify({ kind, ref, ...msg }), { expirationTtl: 86400 });
      ok = true;
      detail = "dev outbox";
    }
  } catch (err) {
    detail = String(err).slice(0, 300);
  }
  await env.DB.prepare("INSERT INTO email_log (ref, kind, recipient, ok, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(ref || null, kind, msg.to, ok ? 1 : 0, detail, now()).run();
  return ok;
}

function corsHeaders(env, req) {
  const origin = req.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const h = { "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type, x-ref, x-key", "access-control-max-age": "86400", vary: "origin" };
  if (allowed.includes(origin)) h["access-control-allow-origin"] = origin;
  return h;
}
function json(data, status, cors) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...cors } });
}

// ---------- registration ----------

function buildRegistration(b) {
  const tier = b.tier;
  if (!["standard", "member", "corporate", "sponsored"].includes(tier)) throw new HttpError(400, "Please choose a ticket first.");
  const r = { tier, size: 1 };
  if (tier === "standard" || tier === "member") {
    r.name = need(clean(b.name, 120), "your full name");
    r.email = need(clean(b.email).toLowerCase(), "your email", "email");
    r.phone = need(clean(b.phone, 30), "your phone number", "phone");
    r.organisation = clean(b.organisation);
    r.situation = SITS.has(b.situation) ? b.situation : "emp";
    if (b.understand !== true) throw new HttpError(400, "Please tick the box to confirm you can attend both days.");
  } else if (tier === "corporate") {
    r.size = Number(b.pack);
    if (r.size !== 3 && r.size !== 5) throw new HttpError(400, "Please choose a team of three or a team of five.");
    r.organisation = need(clean(b.organisation), "the organisation");
    r.email = need(clean(b.email).toLowerCase(), "the contact email", "email");
    const list = Array.isArray(b.attendees) ? b.attendees : [];
    const paid = list.filter((a) => a && !a.judge);
    const judge = list.find((a) => a && a.judge);
    if (paid.length !== r.size || !judge) throw new HttpError(400, `Please name all ${r.size} people and your judge or mentor.`);
    const people = [...paid, judge].map((a, i) => {
      const label = a.judge ? "the judge or mentor" : `seat ${i + 1}`;
      return {
        name: need(clean(a.name, 120), `the name for ${label}`),
        email: need(clean(a.email).toLowerCase(), `the email for ${label}`, "email"),
        role: clean(a.role, 120),
        situation: SITS.has(a.situation) ? a.situation : "emp",
        judge: !!a.judge,
      };
    });
    if (new Set(people.map((p) => p.email)).size !== people.length) throw new HttpError(400, "Each person needs their own email address, because each ticket is sent to the person it is for.");
    r.attendees = JSON.stringify(people);
    r.name = r.organisation;
  } else {
    r.size = Math.floor(Number(b.seats));
    if (!(r.size >= SPONSORED_MIN && r.size <= SPONSORED_MAX)) throw new HttpError(400, `Sponsored seats start at ${SPONSORED_MIN}.`);
    r.name = need(clean(b.name), "the sponsor name");
    r.contact_person = need(clean(b.contactPerson, 120), "the contact person");
    r.email = need(clean(b.email).toLowerCase(), "the email", "email");
    r.phone = need(clean(b.phone, 30), "the phone number", "phone");
    r.named_publicly = b.namedPublicly === false ? 0 : 1;
  }
  r.amount = amountFor(tier, r.size);
  return r;
}

const REG_FIELDS = ["tier", "size", "amount", "name", "email", "phone", "organisation", "situation", "member_no", "member_year", "contact_person", "named_publicly", "attendees"];

// Members prove membership with the personal code JCI Aso sent them. The
// list lives only in the database (table members), never in the site code.
// A code can hold one live registration at a time; releasing frees it.
async function memberFor(env, raw, ownRef) {
  const code = String(raw || "").replace(/\s+/g, "").toUpperCase().slice(0, 12);
  if (!code) throw new HttpError(400, "Please type the code JCI Aso sent you.");
  const m = await env.DB.prepare("SELECT code, name FROM members WHERE code = ?").bind(code).first();
  if (!m) throw new HttpError(404, "We could not find that code. Check it against the message JCI Aso sent you: it is letters followed by three numbers.", "bad_code");
  const used = await env.DB.prepare("SELECT ref FROM registrations WHERE tier = 'member' AND member_no = ? AND status != 'released' AND ref != ?")
    .bind(m.code, ownRef || "").first();
  if (used) throw new HttpError(409, "This code has already been used to register. If that was not you, email the registration team with your code.", "code_used");
  return m;
}

async function memberCheck(req, env) {
  const b = await readJson(req);
  if (isClosed(await closesAt(env))) throw new HttpError(403, "Registration for QLV 2026 has closed.", "closed");
  await brake(env, req, "member", 12);
  const m = await memberFor(env, b.code, b.ref && b.key ? String(b.ref) : "");
  return { code: m.code, name: m.name };
}

async function register(req, env) {
  const b = await readJson(req);
  if (b.website) throw new HttpError(400, "We could not accept that registration.");
  if (isClosed(await closesAt(env))) throw new HttpError(403, "Registration for QLV 2026 has closed.", "closed");
  const r = buildRegistration(b);
  if (r.tier === "member") {
    // The name always comes from the member list, whatever the page sent.
    const m = await memberFor(env, b.memberCode, b.ref ? String(b.ref) : "");
    r.name = m.name;
    r.member_no = m.code;
  }
  const values = REG_FIELDS.map((f) => (r[f] === undefined ? null : r[f]));
  const stamp = now();

  if (b.ref && b.key) {
    const existing = await env.DB.prepare("SELECT ref, secret, status, proof_at FROM registrations WHERE ref = ?").bind(String(b.ref)).first();
    if (!existing || existing.secret !== b.key) throw new HttpError(404, "Registration not found.", "unknown_ref");
    if (existing.proof_at || existing.status !== "awaiting") throw new HttpError(409, "Proof has already been sent for this reference.", "locked");
    await env.DB.prepare(`UPDATE registrations SET ${REG_FIELDS.map((f) => f + " = ?").join(", ")}, updated_at = ? WHERE ref = ?`)
      .bind(...values, stamp, existing.ref).run();
    return { ref: existing.ref, key: existing.secret, amount: r.amount, email: r.email, status: "awaiting" };
  }

  await brake(env, req, "register", 20);
  const ref = await nextRef(env, "main");
  const secret = token(24);
  await env.DB.prepare(`INSERT INTO registrations (ref, secret, status, created_at, updated_at, ${REG_FIELDS.join(", ")}) VALUES (?, ?, 'awaiting', ?, ?, ${REG_FIELDS.map(() => "?").join(", ")})`)
    .bind(ref, secret, stamp, stamp, ...values).run();
  return { ref, key: secret, amount: r.amount, email: r.email, status: "awaiting" };
}

async function getReg(env, ref, key) {
  if (!ref || !key) throw new HttpError(404, "Registration not found.");
  const reg = await env.DB.prepare("SELECT * FROM registrations WHERE ref = ?").bind(ref).first();
  if (!reg || reg.secret !== key || reg.tier === "adviser") throw new HttpError(404, "Registration not found.");
  return reg;
}

async function uploadProof(req, env, ctx) {
  const reg = await getReg(env, req.headers.get("x-ref"), req.headers.get("x-key"));
  if (reg.status === "released") throw new HttpError(410, "This registration was released. Please email the registration team.");
  if (reg.status === "verified" || reg.status === "confirmed") throw new HttpError(409, "Your transfer has already been verified, so there is nothing more to upload.");
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_PROOF) throw new HttpError(413, "That file is over 5MB. A screenshot is usually much smaller, or try the PDF receipt from your bank.");
  await brake(env, req, "proof", 30);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_PROOF) throw new HttpError(413, "That file is over 5MB. A screenshot is usually much smaller, or try the PDF receipt from your bank.");
  if (!bytes.length) throw new HttpError(400, "That file is empty. Please choose it again.");
  const type = sniff(bytes);
  if (!type) throw new HttpError(415, "That file type will not work. Please upload a JPG, PNG or PDF.");
  const stored = stripMetadata(bytes, type);
  const stamp = now();
  // Stored privately in KV under the reference, never under the original filename.
  await env.KV.put(`proof:${reg.ref}`, stored, { metadata: { type, size: stored.length, at: stamp } });
  await env.DB.prepare("UPDATE registrations SET proof_type = ?, proof_size = ?, proof_at = ?, status = 'awaiting', updated_at = ? WHERE ref = ?")
    .bind(type, stored.length, stamp, stamp, reg.ref).run();
  const fresh = { ...reg, proof_at: stamp, status: "awaiting" };
  ctx.waitUntil(sendMail(env, { to: reg.email, ...mail.proofReceived(fresh, links(env, reg).status) }, reg.ref, "proof_received"));
  return { ok: true, status: "awaiting" };
}

async function status(url, env) {
  const reg = await getReg(env, url.searchParams.get("ref"), url.searchParams.get("k"));
  return {
    ref: reg.ref, tier: reg.tier, size: reg.size, amount: reg.amount, email: reg.email,
    status: reg.status, proof: !!reg.proof_at, situation: reg.situation,
    queryNote: reg.status === "queried" ? reg.query_note : null,
    manage: reg.tier === "sponsored" && reg.status === "confirmed" ? reg.manage_token : null,
  };
}

// ---------- advisers ----------

async function adviser(req, env, ctx) {
  const b = await readJson(req);
  if (b.website) throw new HttpError(400, "We could not accept that.");
  const close = await closesAt(env);
  if (isClosed(Date.parse(close) > Date.parse(ADVISERS_CLOSE_AT) ? close : ADVISERS_CLOSE_AT)) throw new HttpError(403, "Confirmations have closed. Please contact the person who invited you.", "closed");
  const a = {
    name: need(clean(b.name, 120), "your full name"),
    email: need(clean(b.email).toLowerCase(), "your email", "email"),
    phone: need(clean(b.phone, 30), "your phone number", "phone"),
    organisation: need(clean(b.organisation), "your organisation"),
    role: need(clean(b.role, 120), "your role"),
    invited_by: INVITERS.includes(b.invitedBy) ? b.invitedBy : "Someone else",
    mode: MODES.has(b.mode) ? b.mode : "both",
  };
  if (b.canAttend !== true || b.independence !== true) throw new HttpError(400, "Please tick both boxes to confirm.");

  const dupe = await env.DB.prepare("SELECT t.ticket_ref, t.token FROM tickets t JOIN registrations r ON r.ref = t.reg_ref WHERE t.kind = 'adviser' AND t.email = ? AND r.status = 'confirmed'").bind(a.email).first();
  if (dupe) return { ref: dupe.ticket_ref, key: dupe.token, mode: a.mode };

  await brake(env, req, "adviser", 10);
  const ref = await nextRef(env, "adviser");
  const stamp = now();
  const t = { token: token(24), reg_ref: ref, ticket_ref: ref, kind: "adviser", name: a.name, email: a.email, phone: a.phone, role: a.role };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO registrations (ref, secret, tier, size, amount, status, name, email, phone, organisation, role, invited_by, mode, created_at, updated_at, verified_at, sent_at) VALUES (?, ?, 'adviser', 1, 0, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(ref, token(24), a.name, a.email, a.phone, a.organisation, a.role, a.invited_by, a.mode, stamp, stamp, stamp, stamp),
    env.DB.prepare("INSERT INTO tickets (token, reg_ref, ticket_ref, kind, name, email, phone, role, created_at, sent_at) VALUES (?, ?, ?, 'adviser', ?, ?, ?, ?, ?, ?)")
      .bind(t.token, ref, ref, a.name, a.email, a.phone, a.role, stamp, stamp),
  ]);
  const msg = mail.ticketIssued(t, { mode: a.mode }, ticketLinks(env, t));
  msg.attachments = [{ filename: "qlv-2026.ics", content: btoa(mail.adviserIcs(t)), content_type: "text/calendar" }];
  ctx.waitUntil(sendMail(env, { to: a.email, ...msg }, ref, "adviser_confirmed"));
  return { ref, key: t.token, mode: a.mode };
}

// ---------- sponsored claims ----------

async function claimState(env, reg) {
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM tickets WHERE reg_ref = ? AND kind = 'sponsored'").bind(reg.ref).first();
  if (reg.status !== "confirmed") return { state: "pending", taken: n };
  if (isClosed(await closesAt(env))) return { state: "closed", taken: n };
  if (n >= reg.size) return { state: "full", taken: n };
  return { state: "open", taken: n };
}
async function regByClaim(env, t) {
  const reg = t ? await env.DB.prepare("SELECT * FROM registrations WHERE claim_token = ?").bind(String(t)).first() : null;
  if (!reg) throw new HttpError(404, "This claim link is not valid.");
  return reg;
}

async function claimInfo(url, env) {
  const reg = await regByClaim(env, url.searchParams.get("t"));
  const s = await claimState(env, reg);
  return { state: s.state, left: Math.max(0, reg.size - s.taken) };
}

async function claim(req, env, ctx) {
  const b = await readJson(req);
  if (b.website) throw new HttpError(400, "We could not accept that.");
  const reg = await regByClaim(env, b.t);
  const c = {
    name: need(clean(b.name, 120), "your full name"),
    email: need(clean(b.email).toLowerCase(), "your email", "email"),
    phone: need(clean(b.phone, 30), "your phone number", "phone"),
    situation: SITS.has(b.situation) ? b.situation : "emp",
    organisation: clean(b.organisation),
  };
  const s = await claimState(env, reg);
  if (s.state === "closed") throw new HttpError(403, `This claim link closed on ${closeLabel(await closesAt(env))}.`, "closed");
  if (s.state === "pending") throw new HttpError(409, "Your sponsor's transfer is still being checked. Try again later today.", "pending");

  // The same person pressing the button twice gets their existing seat back.
  const mine = await env.DB.prepare("SELECT * FROM tickets WHERE reg_ref = ? AND kind = 'sponsored' AND email = ?").bind(reg.ref, c.email).first();
  if (mine && mine.ticket_ref !== "pending") return { ref: mine.ticket_ref, key: mine.token, email: mine.email };

  await brake(env, req, "claim", 20);
  const t = { token: token(24), reg_ref: reg.ref, kind: "sponsored", ...c };
  const stamp = now();
  // The seat cap is enforced in the insert itself, so two people claiming the
  // last seat at the same moment cannot both get it.
  const ins = await env.DB.prepare(`INSERT INTO tickets (token, reg_ref, ticket_ref, kind, name, email, phone, situation, organisation, created_at)
      SELECT ?, ?, 'pending', 'sponsored', ?, ?, ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM tickets WHERE reg_ref = ? AND kind = 'sponsored') < ?`)
    .bind(t.token, reg.ref, c.name, c.email, c.phone, c.situation, c.organisation || null, stamp, reg.ref, reg.size).run();
  if (!ins.meta.changes) throw new HttpError(409, "All the seats on this link have been claimed.", "full");
  t.ticket_ref = await nextRef(env, "sponsored");
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM tickets WHERE reg_ref = ? AND kind = 'sponsored'").bind(reg.ref).first();
  await env.DB.prepare("UPDATE tickets SET ticket_ref = ?, seat_no = ?, sent_at = ? WHERE token = ?").bind(t.ticket_ref, n, stamp, t.token).run();
  await seatPending(env);

  // The sponsor's money was verified by a person before this link went out,
  // so a claimed seat's ticket goes straight to the claimant.
  ctx.waitUntil((async () => {
    await sendMail(env, { to: c.email, ...mail.ticketIssued(t, reg, ticketLinks(env, t)) }, t.ticket_ref, "ticket_issued");
    await sendMail(env, { to: reg.email, ...mail.seatClaimed(reg, t, n, links(env, reg).manage, closeLabel(await closesAt(env))) }, reg.ref, "seat_claimed");
  })());
  return { ref: t.ticket_ref, key: t.token, email: c.email };
}

// ---------- partner seats ----------
// Each partner seat has its own link. Same claim form as sponsored seats; the
// organisation used for seating is the partner's.

async function seatByToken(env, t) {
  const s = t ? await env.DB.prepare(`SELECT s.*, p.name AS partner_name, p.status, p.reg_ref FROM partner_seats s JOIN partners p ON p.id = s.partner_id
    WHERE s.token = ?`).bind(String(t)).first() : null;
  if (!s) throw new HttpError(404, "This seat link is not valid.");
  return s;
}

async function partnerSeatInfo(url, env) {
  const s = await seatByToken(env, url.searchParams.get("t"));
  if (s.status !== "confirmed") return { state: "pending" };
  if (s.ticket_id) return { state: "claimed" };
  if (isClosed(ADVISERS_CLOSE_AT)) return { state: "closed" };
  return { state: "open" };
}

async function partnerSeatClaim(req, env, ctx) {
  const b = await readJson(req);
  if (b.website) throw new HttpError(400, "We could not accept that.");
  const s = await seatByToken(env, b.t);
  if (s.status !== "confirmed") throw new HttpError(409, "This seat is not ready yet. Try again later.", "pending");
  if (s.ticket_id) throw new HttpError(409, "This seat has already been claimed.", "full");
  if (isClosed(ADVISERS_CLOSE_AT)) throw new HttpError(403, "This link has closed.", "closed");
  const c = {
    name: need(clean(b.name, 120), "your full name"),
    email: need(clean(b.email).toLowerCase(), "your email", "email"),
    phone: need(clean(b.phone, 30), "your phone number", "phone"),
    situation: SITS.has(b.situation) ? b.situation : "emp",
  };
  await brake(env, req, "claim", 20);
  const stamp = now();
  const t = { token: token(24), reg_ref: s.reg_ref, kind: "partner", ...c };
  const row = await env.DB.prepare(`INSERT INTO tickets (token, reg_ref, ticket_ref, kind, name, email, phone, situation, partner_id, created_at)
    VALUES (?, ?, 'pending', 'partner', ?, ?, ?, ?, ?, ?) RETURNING id`).bind(t.token, s.reg_ref, c.name, c.email, c.phone, c.situation, s.partner_id, stamp).first();
  // Taking the seat is one conditional update, so two people opening the same
  // link at once cannot both get it.
  const took = await env.DB.prepare("UPDATE partner_seats SET ticket_id = ? WHERE id = ? AND ticket_id IS NULL").bind(row.id, s.id).run();
  if (!took.meta.changes) {
    await env.DB.prepare("DELETE FROM tickets WHERE id = ?").bind(row.id).run();
    throw new HttpError(409, "This seat has already been claimed.", "full");
  }
  t.ticket_ref = await nextRef(env, "partner");
  await env.DB.prepare("UPDATE tickets SET ticket_ref = ?, sent_at = ? WHERE id = ?").bind(t.ticket_ref, stamp, row.id).run();
  await seatPending(env);
  ctx.waitUntil(sendMail(env, { to: c.email, ...mail.ticketIssued(t, {}, ticketLinks(env, t)) }, t.ticket_ref, "ticket_issued"));
  return { ref: t.ticket_ref, key: t.token, email: c.email };
}

async function sponsorView(url, env) {
  const m = url.searchParams.get("m");
  const reg = m ? await env.DB.prepare("SELECT * FROM registrations WHERE manage_token = ?").bind(String(m)).first() : null;
  if (!reg) throw new HttpError(404, "This link is not valid.");
  const { results } = await env.DB.prepare("SELECT ticket_ref FROM tickets WHERE reg_ref = ? AND kind = 'sponsored' AND ticket_ref != 'pending' ORDER BY id").bind(reg.ref).all();
  return {
    ref: reg.ref, seats: reg.size, closed: isClosed(await closesAt(env)),
    claimUrl: reg.status === "confirmed" ? links(env, reg).claim : null,
    claims: results.map((r) => ({ ref: r.ticket_ref })),
  };
}

// ---------- tickets and answers ----------

async function ticketByToken(env, t) {
  if (!t) return null;
  return env.DB.prepare("SELECT t.*, r.amount, r.mode, r.organisation AS reg_org, r.tier FROM tickets t JOIN registrations r ON r.ref = t.reg_ref WHERE t.token = ?").bind(String(t)).first();
}

async function ticketView(url, env) {
  const t = await ticketByToken(env, url.searchParams.get("t"));
  if (!t || !t.sent_at || t.cancelled_at) throw new HttpError(404, "Ticket not found.");
  return { name: t.name, ref: t.ticket_ref, kind: t.kind, mode: t.mode, situation: t.situation, days: mail.dayLines(t).map(([k]) => k), paidLine: mail.paidLine(t, t) };
}

// An answer key is either a registration secret (standard and member, from
// the pending screen, and corporate billing contacts) or a ticket token.
async function answerHolder(env, key) {
  if (!key) throw new HttpError(404, "This link is not valid.");
  const t = await ticketByToken(env, key);
  if (t && t.sent_at && !t.cancelled_at) return { holder: `t:${t.id}`, branch: t.situation };
  const reg = await env.DB.prepare("SELECT ref, tier, situation, proof_at, status FROM registrations WHERE secret = ?").bind(String(key)).first();
  if (reg && reg.proof_at && reg.status !== "released" && reg.tier !== "sponsored") {
    return { holder: `r:${reg.ref}`, branch: reg.tier === "corporate" ? null : reg.situation };
  }
  throw new HttpError(404, "This link is not valid.");
}

async function answerContext(url, env) {
  const h = await answerHolder(env, url.searchParams.get("k"));
  return { branch: h.branch || null, closed: isClosed(await closesAt(env)) };
}

async function answers(req, env) {
  const b = await readJson(req);
  const close = await closesAt(env);
  if (isClosed(close)) throw new HttpError(403, `Answers closed on ${closeLabel(close)}. Thank you for thinking of it.`, "closed");
  const h = await answerHolder(env, b.key);
  const set = QBANK[b.branch];
  if (!set) throw new HttpError(400, "Please choose the situation closest to yours.");
  const a = Array.isArray(b.answers) ? b.answers.map((x) => clean(x, MAX_ANSWER)) : [];
  if (a.length !== set.q.length) throw new HttpError(400, "Please answer the questions shown.");
  if (set.q.some((q, i) => !q.opt && !a[i])) throw new HttpError(400, "Please answer the first two. The third can stay blank if it has not happened to you.");
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM answers WHERE holder = ?").bind(h.holder).first();
  if (n >= MAX_ANSWER_SETS) throw new HttpError(429, "Thank you, we have plenty from you already.");
  await env.DB.prepare("INSERT INTO answers (holder, branch, a1, a2, a3, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(h.holder, b.branch, a[0] || null, a[1] || null, a[2] || null, now()).run();
  return { ok: true };
}

// ---------- router ----------

const ROUTES = {
  "GET /api/config": async (req, env) => ({ closesAt: await closesAt(env) }),
  "POST /api/register": (req, env) => register(req, env),
  "POST /api/member-check": (req, env) => memberCheck(req, env),
  "POST /api/proof": (req, env, ctx) => uploadProof(req, env, ctx),
  "GET /api/status": (req, env, ctx, url) => status(url, env),
  "POST /api/adviser": (req, env, ctx) => adviser(req, env, ctx),
  "GET /api/claim": (req, env, ctx, url) => claimInfo(url, env),
  "POST /api/claim": (req, env, ctx) => claim(req, env, ctx),
  "GET /api/sponsor": (req, env, ctx, url) => sponsorView(url, env),
  "GET /api/partner-seat": (req, env, ctx, url) => partnerSeatInfo(url, env),
  "POST /api/partner-seat": (req, env, ctx) => partnerSeatClaim(req, env, ctx),
  "GET /api/ticket": (req, env, ctx, url) => ticketView(url, env),
  "GET /api/answer-context": (req, env, ctx, url) => answerContext(url, env),
  "POST /api/answers": (req, env) => answers(req, env),
};

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return handleAdmin(req, env, ctx, url);

    const cors = corsHeaders(env, req);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const route = ROUTES[`${req.method} ${url.pathname}`];
    if (!route) return json({ error: "Not found." }, 404, cors);
    try {
      return json(await route(req, env, ctx, url), 200, cors);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message, code: err.code }, err.status, cors);
      console.error(err);
      return json({ error: "Something went wrong on our side. Please try again in a minute." }, 500, cors);
    }
  },
};
