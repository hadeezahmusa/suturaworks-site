// Admin for QLV 2026, served by the Worker at /admin.
//
// Sign in: enter an address on ADMIN_EMAILS, get a one-time link by email,
// press Continue on the page it opens. That sets a signed, HttpOnly cookie
// for 7 days. Every admin call checks the cookie, and every change needs
// the x-admin header, which another site cannot send.
//
// Verifying is two steps on purpose: "Payment verified" makes the tickets
// (or the sponsor's claim link) without sending anything, the admin previews
// each email, then "Send" sends them.

import { RELEASE_AFTER_DAYS, TIER_NAME, ngn, closeLabel, closeAtFor } from "../../qlv2026/event.js";
import { QBANK } from "../../qlv2026/questions.js";
import * as mail from "./emails.js";
import { HttpError, now, token, links, ticketLinks, sendMail, closesAt, sharesLink } from "./index.js";
import { THEME, tableName } from "./config.js";
import { seatPending } from "./seating.js";
import * as ops from "./admin-ops.js";
import * as money from "./money.js";
import * as logos from "./logos.js";
import * as lobby from "./lobby.js";
import { BOARD_CAN, boardSessionOk, boardView, boardAction, boardLogin, redact } from "./board.js";
import { VIEWS_HTML, VIEWS_JS, VIEWS_STYLE } from "./admin-views.js";
import { sendBatch, dailyRoom, DAILY_SAFE } from "./mailer.js";
import { part2Routes, sheetsPage } from "./part2-admin.js";
import { P2_HTML, P2_JS, P2_STYLE, ONE_VIEW_JS } from "./part2-views.js";
import { MONEY_HTML, MONEY_JS } from "./money-views.js";

// The treasurer's only page besides Registrations: Money, to read.
const READ_ONLY_VIEWS = `
function showView(tab) {
  $("#moneyView").hidden = tab !== "money";
  if (tab === "money") loadMoney().catch((err) => msg(err.message));
}`;

const COOKIE = "qlv_admin";
const SESSION_HOURS = 24 * 7;
const enc = new TextEncoder();

// ---------- session ----------

function emails(v) {
  return (v || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}
// Roles. Admins (ADMIN_EMAILS) can do everything. Verifiers
// (VERIFIER_EMAILS, a secret so personal addresses stay out of the code) see
// the registrations list and proofs, mark payments verified and undo their
// own verification, and can read the Money tab. Desk volunteers see only
// Check-in and stage operators only Stage; admin adds both on the Settings tab.
// The board signs in with a shared passcode, not an email, and only reads.
async function roleOf(env, email) {
  if (!email) return null;
  if (email.startsWith("board:")) return (await boardSessionOk(env, email)) ? "board" : null;
  if (emails(env.ADMIN_EMAILS).includes(email)) return "admin";
  if (emails(env.VERIFIER_EMAILS).includes(email)) return "verifier";
  const row = await env.DB.prepare("SELECT role FROM access WHERE email = ?").bind(email).first();
  return row && ["desk", "stage"].includes(row.role) ? row.role : null;
}
// What each role besides admin may call. Anything not listed is admin only.
const CAN = {
  verifier: new Set(["GET list", "GET reg", "POST verify", "POST unverify", "GET money"]),
  desk: new Set(["GET checkin", "POST checkin"]),
  stage: new Set(["GET stage", "POST stage", "GET display-link"]),
  board: BOARD_CAN,
};
function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmac(env, text) {
  if (!env.SESSION_SECRET) throw new HttpError(500, "SESSION_SECRET is not set.");
  const key = await crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
}
function same(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function makeCookie(env, email) {
  const payload = b64url(enc.encode(`${email}|${Date.now() + SESSION_HOURS * 3600000}`));
  return `${COOKIE}=${payload}.${await hmac(env, payload)}; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`;
}
async function session(req, env) {
  const raw = (req.headers.get("cookie") || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return null;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!payload || !sig || !same(sig, await hmac(env, payload))) return null;
  let email, exp;
  try { [email, exp] = atob(payload.replace(/-/g, "+").replace(/_/g, "/")).split("|"); } catch { return null; }
  if (Date.now() > Number(exp) || !(await roleOf(env, email))) return null;
  return email;
}

// ---------- responses ----------

const SECURITY = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow",
  "cache-control": "no-store",
};
function html(body, status = 200, extra = {}) {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", ...SECURITY, ...extra } });
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...SECURITY } });
}
const e = mail.esc;

// ---------- data ----------

async function reg(env, ref) {
  const r = ref ? await env.DB.prepare("SELECT * FROM registrations WHERE ref = ?").bind(String(ref)).first() : null;
  if (!r) throw new HttpError(404, "No registration with that reference.");
  return r;
}
async function tickets(env, ref) {
  return (await env.DB.prepare("SELECT * FROM tickets WHERE reg_ref = ? ORDER BY id").bind(ref).all()).results;
}
function flagged(r) {
  return r.status === "awaiting" && Date.now() - Date.parse(r.created_at) > RELEASE_AFTER_DAYS * 86400000;
}

async function list(env, filter) {
  const { results } = await env.DB.prepare(`SELECT r.ref, r.tier, r.size, r.amount, r.status, r.name, r.contact_person, r.organisation, r.email,
      r.created_at, r.proof_at, r.verified_at, r.sent_at,
      (SELECT COUNT(*) FROM tickets t WHERE t.reg_ref = r.ref AND t.kind IN ('sponsored', 'standard') AND t.ticket_ref != 'pending' AND t.sent_at IS NOT NULL) AS claimed,
      (r.attendees IS NULL AND r.tier IN ('sponsored', 'standard') AND r.size > 1) AS shares
    FROM registrations r WHERE r.tier NOT IN ('partner', 'facilitator') ORDER BY r.created_at DESC`).all();
  const rows = results.map((r) => ({ ...r, flagged: flagged(r) }));
  const counts = { all: 0, awaiting: 0, flagged: 0, verified: 0, confirmed: 0, queried: 0, released: 0, adviser: 0 };
  for (const r of rows) {
    if (r.tier === "adviser") { counts.adviser++; continue; }
    counts.all++;
    counts[r.status]++;
    if (r.flagged) counts.flagged++;
  }
  const pick = rows.filter((r) =>
    filter === "adviser" ? r.tier === "adviser"
      : r.tier !== "adviser" && (filter === "all" || !filter || (filter === "flagged" ? r.flagged : r.status === filter)));
  const close = await closesAt(env);
  return { rows: pick, counts, releaseAfterDays: RELEASE_AFTER_DAYS, closesAt: close, closed: Date.now() >= Date.parse(close) };
}

async function detail(env, ref) {
  const r = await reg(env, ref);
  const t = await tickets(env, r.ref);
  const log = (await env.DB.prepare("SELECT kind, recipient, ok, created_at FROM email_log WHERE ref = ? ORDER BY id DESC LIMIT 30").bind(r.ref).all()).results;
  const { secret, ...safe } = r;
  return {
    reg: { ...safe, attendees: r.attendees ? JSON.parse(r.attendees) : null, shares: sharesLink(r), flagged: flagged(r), tierName: TIER_NAME[r.tier], amountText: ngn(r.amount) },
    tickets: (await (async () => { const free = new Set(await ops.replaceableIds(env, r.ref)); return t.map((x) => ({ ...x, replaceable: free.has(x.id) })); })()).map(({ token: _t, ...rest }) => ({ ...rest, table: rest.table_index === null || rest.table_index === undefined ? null : `${tableName(rest.table_index)}, seat ${rest.table_seat}` })),
    log,
    claimUrl: r.status === "confirmed" ? links(env, r).claim : null,
  };
}

// Makes the tickets for a verified booking, or the claim link for a sponsor.
// Nothing is sent here.
async function verify(env, ref, who) {
  const r = await reg(env, ref);
  if (!["awaiting", "queried"].includes(r.status)) throw new HttpError(409, `This registration is ${r.status}, so it cannot be verified now.`);
  const stamp = now();
  const stmts = [env.DB.prepare("DELETE FROM tickets WHERE reg_ref = ? AND sent_at IS NULL").bind(r.ref)];
  const add = (kind, seat, p, ref = r.ref) => env.DB.prepare("INSERT INTO tickets (token, reg_ref, ticket_ref, kind, seat_no, name, email, phone, role, situation, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(token(24), r.ref, ref, kind, seat, p.name, p.email, p.phone || null, p.role || null, p.situation || null, stamp);
  if (r.tier === "standard" && r.size > 1 && r.attendees) {
    // A group whose buyer named everyone: one ticket each, QLV26-012-1 and so on.
    JSON.parse(r.attendees).forEach((p, i) => stmts.push(add("standard", i + 1, p, `${r.ref}-${i + 1}`)));
  } else if (r.tier === "standard" && r.size > 1) {
    stmts.push(env.DB.prepare("UPDATE registrations SET claim_token = COALESCE(claim_token, ?), manage_token = COALESCE(manage_token, ?) WHERE ref = ?").bind(token(10), token(24), r.ref));
  } else if (r.tier === "standard" || r.tier === "member") stmts.push(add(r.tier, 1, r));
  else if (r.tier === "corporate") JSON.parse(r.attendees).forEach((p, i) => stmts.push(add(p.judge ? "judge" : "corporate", i + 1, p)));
  else if (r.tier === "sponsored") {
    stmts.push(env.DB.prepare("UPDATE registrations SET claim_token = COALESCE(claim_token, ?), manage_token = COALESCE(manage_token, ?) WHERE ref = ?").bind(token(10), token(24), r.ref));
  } else throw new HttpError(409, "Advisers are confirmed when they sign up.");
  stmts.push(env.DB.prepare("UPDATE registrations SET status = 'verified', verified_at = ?, verified_by = ?, updated_at = ? WHERE ref = ?").bind(stamp, who, stamp, r.ref));
  await env.DB.batch(stmts);
  // Standard, member and corporate seats take a table the moment payment is verified.
  await seatPending(env);
  return detail(env, r.ref);
}

async function unverify(env, ref, who, role) {
  const r = await reg(env, ref);
  if (r.status !== "verified") throw new HttpError(409, "Only a verification that has not been sent can be undone.");
  if (role === "verifier" && r.verified_by !== who) throw new HttpError(403, "Only the person who verified this can undo it.");
  const stamp = now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM tickets WHERE reg_ref = ? AND sent_at IS NULL").bind(r.ref),
    env.DB.prepare("UPDATE registrations SET status = 'awaiting', verified_at = NULL, verified_by = NULL, updated_at = ? WHERE ref = ?").bind(stamp, r.ref),
  ]);
  return detail(env, r.ref);
}

// The emails "Send" would send, built exactly as they will go out.
async function outgoing(env, r) {
  const out = [];
  if (sharesLink(r)) {
    const l = links(env, r);
    const close = closeLabel(await closesAt(env));
    out.push(r.tier === "sponsored"
      ? { kind: "sponsor_link", to: r.email, ...mail.sponsorLink(r, l.claim, l.manage, close) }
      : { kind: "group_link", to: r.email, ...mail.groupLink(r, l.claim, l.manage, close) });
    return out;
  }
  const t = await tickets(env, r.ref);
  for (const tk of t) {
    if (tk.sent_at) continue;
    // Previews show the lobby link without counting the person as told.
    const lobbyLink = await lobby.lobbyLinkForTicket(env, tk, false);
    out.push({ kind: "ticket_issued", ticketId: tk.id, lobby: !!lobbyLink, to: tk.email, ...mail.ticketIssued(tk, r, { ...ticketLinks(env, tk), lobby: lobbyLink }) });
  }
  if (r.tier === "corporate" && !r.sent_at) out.push({ kind: "corporate_receipt", to: r.email, ...mail.corporateReceipt(r, t) });
  if (r.tier === "standard" && r.size > 1 && !r.sent_at) out.push({ kind: "group_receipt", to: r.email, ...mail.groupReceipt(r, t) });
  return out;
}

async function preview(env, ref) {
  const r = await reg(env, ref);
  if (r.status !== "verified") throw new HttpError(409, "Press Payment verified first.");
  return (await outgoing(env, r)).map(({ to, subject, html: h, kind }) => ({ to, subject, html: h, kind }));
}

async function send(env, ref) {
  const r = await reg(env, ref);
  if (r.status !== "verified") throw new HttpError(409, "Press Payment verified first.");
  const failed = [];
  for (const m of await outgoing(env, r)) {
    if (m.lobby) await lobby.markLobbyTold(env, m.ticketId);
    const ok = await sendMail(env, { to: m.to, subject: m.subject, html: m.html, text: m.text }, r.ref, m.kind);
    if (!ok) { failed.push(m.to); continue; }
    if (m.ticketId) await env.DB.prepare("UPDATE tickets SET sent_at = ? WHERE id = ?").bind(now(), m.ticketId).run();
  }
  if (!failed.length) {
    const stamp = now();
    await env.DB.prepare("UPDATE registrations SET status = 'confirmed', sent_at = ?, updated_at = ? WHERE ref = ?").bind(stamp, stamp, r.ref).run();
  }
  return { failed, ...(await detail(env, r.ref)) };
}

function queryNote(b) {
  return String(b.note || "").trim().slice(0, 2000);
}
async function queryPreview(env, b) {
  const r = await reg(env, b.ref);
  const m = mail.couldNotMatch(r, queryNote(b), links(env, r).status);
  return { to: r.email, subject: m.subject, html: m.html };
}
async function query(env, b) {
  const r = await reg(env, b.ref);
  if (!["awaiting", "queried"].includes(r.status)) throw new HttpError(409, `This registration is ${r.status}. Undo the verification first if you need to query it.`);
  const note = queryNote(b);
  const m = mail.couldNotMatch(r, note, links(env, r).status);
  const ok = await sendMail(env, { to: r.email, ...m }, r.ref, "could_not_match");
  if (!ok) throw new HttpError(502, "The email did not send. Nothing has changed. Try again in a minute.");
  const stamp = now();
  await env.DB.prepare("UPDATE registrations SET status = 'queried', query_note = ?, queried_at = ?, updated_at = ? WHERE ref = ?").bind(note || null, stamp, stamp, r.ref).run();
  return detail(env, r.ref);
}

async function release(env, ref) {
  const r = await reg(env, ref);
  if (!["awaiting", "queried"].includes(r.status)) throw new HttpError(409, `This registration is ${r.status}, so it cannot be released.`);
  const stamp = now();
  await env.DB.prepare("UPDATE registrations SET status = 'released', released_at = ?, updated_at = ? WHERE ref = ?").bind(stamp, stamp, r.ref).run();
  return detail(env, r.ref);
}
async function reopen(env, ref) {
  const r = await reg(env, ref);
  if (r.status !== "released") throw new HttpError(409, "Only a released registration can be reopened.");
  await env.DB.prepare("UPDATE registrations SET status = 'awaiting', released_at = NULL, updated_at = ? WHERE ref = ?").bind(now(), r.ref).run();
  return detail(env, r.ref);
}

// Corrects a ticket's email (a typo is the usual reason) and sends it again.
async function resendTicket(env, b) {
  const t = await env.DB.prepare("SELECT * FROM tickets WHERE id = ?").bind(Number(b.id)).first();
  if (!t || !t.sent_at) throw new HttpError(404, "That ticket has not been sent yet.");
  const r = await reg(env, t.reg_ref);
  const email = String(b.email || t.email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "That email address does not look complete.");
  const tk = { ...t, email };
  const msg = mail.ticketIssued(tk, r, { ...ticketLinks(env, tk), lobby: await lobby.lobbyLinkForTicket(env, tk) });
  if (t.kind === "adviser") msg.attachments = [{ filename: "qlv-2026.ics", content: btoa(mail.adviserIcs(tk)), content_type: "text/calendar" }];
  const ok = await sendMail(env, { to: email, ...msg }, r.ref, "ticket_resent");
  if (!ok) throw new HttpError(502, "The email did not send. Try again in a minute.");
  await env.DB.prepare("UPDATE tickets SET email = ?, sent_at = ? WHERE id = ?").bind(email, now(), t.id).run();
  return detail(env, r.ref);
}

// Moves the closing date. Registration, sponsored claims and new answers all
// close at the end of this day, Abuja time. A date in the past closes now; a
// later date reopens.
async function setClosing(env, b) {
  const date = String(b.date || "");
  if (!/^2026-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) || Number.isNaN(Date.parse(date))) {
    throw new HttpError(400, "Pick a date in 2026.");
  }
  if (date > "2026-11-06") throw new HttpError(400, "Registration cannot stay open past day one, 6 November.");
  await env.KV.put("setting:closes_at", closeAtFor(date));
  return list(env, b.status || "awaiting");
}

// ---------- answers reminder ----------
// One reminder per ticket holder who has not sent the three answers.
// Resend's free plan allows 100 emails a day, so a batch never takes the last
// 24 hours past DAILY_SAFE and never sends more than REMINDER_BATCH at once:
// ticket emails sent the same day still have room. The admin sees counts
// only, never who has or has not answered.
const REMINDER_BATCH = 70;

// Participants with a sent ticket who have no answers yet and no reminder
// yet. Standard and member registrants may have answered from the pending
// screen, which is stored against the registration (r:REF), so that counts.
// A corporate billing contact's or group buyer's answers do not count for the attendees.
const WAITING_SQL = `SELECT t.id, t.token, t.ticket_ref, t.reg_ref, t.name, t.email
  FROM tickets t JOIN registrations r ON r.ref = t.reg_ref
  WHERE t.sent_at IS NOT NULL AND r.status = 'confirmed'
    AND t.kind IN ('standard', 'member', 'corporate', 'sponsored', 'partner') AND t.cancelled_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM answers a WHERE a.holder = 't:' || t.id)
    AND NOT (t.kind IN ('standard', 'member') AND r.size = 1 AND EXISTS (SELECT 1 FROM answers a WHERE a.holder = 'r:' || t.reg_ref))
    AND NOT EXISTS (SELECT 1 FROM email_log l WHERE l.kind = 'answers_reminder' AND l.ok = 1 AND l.ref = t.reg_ref AND l.recipient = t.email)
  ORDER BY t.id`;

// ---------- member codes ----------
// Each JCI Aso member with an email on file gets their own code once.
// Members who have already registered with their code are skipped.
const CODES_WAITING_SQL = `SELECT m.code, m.name, m.email FROM members m
  WHERE m.email IS NOT NULL AND m.email != ''
    AND NOT EXISTS (SELECT 1 FROM email_log l WHERE l.kind = 'member_code' AND l.ok = 1 AND l.ref = m.code AND l.recipient = m.email)
    AND NOT EXISTS (SELECT 1 FROM registrations r WHERE r.tier = 'member' AND r.member_no = m.code AND r.status != 'released')
  ORDER BY m.code`;

async function codesStatus(env) {
  const [waiting, counts] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM (${CODES_WAITING_SQL})`),
    env.DB.prepare(`SELECT COUNT(*) AS members, SUM(email IS NOT NULL AND email != '') AS with_email,
      (SELECT COUNT(DISTINCT ref) FROM email_log WHERE kind = 'member_code' AND ok = 1) AS sent FROM members`),
  ]);
  const { sent24h, room } = await dailyRoom(env);
  const close = await closesAt(env);
  const w = waiting.results[0].n;
  const c = counts.results[0];
  return {
    waiting: w, members: c.members, withEmail: c.with_email || 0, sent: c.sent || 0,
    sent24h, dailySafe: DAILY_SAFE, batch: Math.min(w, REMINDER_BATCH, room),
    closed: Date.now() >= Date.parse(close), closeDate: closeLabel(close),
  };
}

async function codesPreview(env) {
  const close = closeLabel(await closesAt(env));
  const m = mail.memberCode({ name: "Ada Obi", code: "ABC123" }, env.SITE_URL, close);
  return { subject: m.subject, html: m.html };
}

async function sendCodes(env) {
  const st = await codesStatus(env);
  if (st.closed) throw new HttpError(409, "Registration has closed, so codes would be no use now.");
  if (!st.waiting) throw new HttpError(409, "Every member with an email has been sent their code or has already registered.");
  if (!st.batch) throw new HttpError(409, `${st.sent24h} emails have gone out in the last 24 hours, which is the safe limit on the free plan. Try again tomorrow.`);
  const rows = (await env.DB.prepare(`${CODES_WAITING_SQL} LIMIT ?`).bind(st.batch).all()).results;
  await sendBatch(env, rows.map((m) => ({ ref: m.code, to: m.email, ...mail.memberCode(m, env.SITE_URL, st.closeDate) })), "member_code");
  return { sent: rows.length, ...(await codesStatus(env)) };
}

// Correcting a member: spelling or order of the name, the code to match
// (initials plus the same three numbers), and the email. Everything is kept
// in member_changes, and the old code keeps working on the registration page.
// A member who has already registered gets the corrected name on their
// registration and ticket; their ticket reference does not change.
function initials(name) {
  return (String(name).match(/[A-Za-z][A-Za-z'-]*/g) || []).map((w) => w[0]).join("").toUpperCase();
}

async function membersList(env) {
  const { results } = await env.DB.prepare(`SELECT m.code, m.name, m.email,
      (SELECT r.ref FROM registrations r WHERE r.tier = 'member' AND r.member_no = m.code AND r.status != 'released' LIMIT 1) AS reg_ref,
      (SELECT MAX(l.created_at) FROM email_log l WHERE l.kind = 'member_code' AND l.ok = 1 AND l.ref = m.code) AS sent_at,
      (SELECT group_concat(c.old_code, ', ') FROM member_changes c WHERE c.code = m.code AND c.old_code != m.code) AS old_codes,
      (SELECT MAX(c.changed_at) FROM member_changes c WHERE c.code = m.code) AS changed_at
    FROM members m ORDER BY m.name COLLATE NOCASE`).all();
  return { members: results, closed: Date.now() >= Date.parse(await closesAt(env)) };
}

async function memberFix(env, b, who) {
  const m = await env.DB.prepare("SELECT code, name, email FROM members WHERE code = ?").bind(String(b.code || "")).first();
  if (!m) throw new HttpError(404, "That member is no longer on the list. Refresh the page.");
  const name = String(b.name || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (initials(name).length < 2) throw new HttpError(400, "Type the member's full name, at least two names.");
  const email = String(b.email || "").trim().toLowerCase().slice(0, 160) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, "That email address does not look right.");
  const code = String(b.newCode || "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{1,8}\d{3}$/.test(code)) throw new HttpError(400, "A code is letters followed by three numbers, for example AMS892.");
  const codeChanged = code !== m.code, nameChanged = name !== m.name, emailChanged = email !== (m.email || null);
  if (!codeChanged && !nameChanged && !emailChanged && !b.send) throw new HttpError(400, "Nothing has changed.");
  if (codeChanged) {
    const clash = await env.DB.prepare(`SELECT code FROM members WHERE code = ?1
      UNION SELECT code FROM member_changes WHERE old_code = ?1 AND code != ?2 LIMIT 1`).bind(code, m.code).first();
    if (clash) throw new HttpError(409, `${code} is already used by another member, now or before. Change one of the numbers.`);
  }
  const stamp = now();
  if (codeChanged || nameChanged || emailChanged) {
    await env.DB.batch([
      env.DB.prepare("UPDATE member_changes SET code = ? WHERE code = ?").bind(code, m.code),
      env.DB.prepare(`INSERT INTO member_changes (old_code, code, old_name, new_name, old_email, new_email, changed_at, changed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(m.code, code, m.name, name, m.email || null, email, stamp, who),
      env.DB.prepare("UPDATE members SET code = ?, name = ?, email = ? WHERE code = ?").bind(code, name, email, m.code),
      env.DB.prepare("UPDATE registrations SET member_no = ?, name = ?, updated_at = ? WHERE tier = 'member' AND member_no = ?").bind(code, name, stamp, m.code),
      env.DB.prepare("UPDATE tickets SET name = ? WHERE kind = 'member' AND reg_ref IN (SELECT ref FROM registrations WHERE tier = 'member' AND member_no = ?)").bind(name, code),
    ]);
  }
  const reg = await env.DB.prepare("SELECT ref, status, sent_at FROM registrations WHERE tier = 'member' AND member_no = ? AND status != 'released' LIMIT 1").bind(code).first();
  // Once saved, a reason the email could not go is a warning, not an error,
  // so the page still shows the saved correction.
  let emailed = false, warning = "";
  if (b.send) {
    const close = await closesAt(env);
    if (!email) warning = "Saved, but there is no email address to send the code to.";
    else if (reg) warning = `Saved. ${name} has already registered as ${reg.ref}, so a code email would only confuse them. Resend their ticket from Registrations instead.`;
    else if (Date.now() >= Date.parse(close)) warning = "Saved, but registration has closed, so the code was not sent.";
    else if (!(await dailyRoom(env)).room) warning = `Saved, but ${DAILY_SAFE} emails have gone out in the last 24 hours, the safe limit on the free plan. Send it tomorrow.`;
    else {
      // The corrected wording only if the name or code was ever corrected; adding
      // a missing email alone sends the ordinary code email.
      const h = await env.DB.prepare("SELECT SUM(old_name IS NOT new_name OR old_code != code) AS fixed, SUM(old_code != code) AS moved FROM member_changes WHERE code = ?").bind(code).first();
      const fix = h.fixed ? { codeChanged: !!h.moved } : null;
      emailed = await sendMail(env, { to: email, ...mail.memberCode({ code, name }, env.SITE_URL, closeLabel(close), fix) }, code, "member_code");
      if (!emailed) warning = "Saved, but the email did not go. Try sending again in a few minutes.";
    }
  }
  return { code, name, email, emailed, warning, reg: reg ? { ref: reg.ref, status: reg.status, ticketSent: !!reg.sent_at } : null, ...(await membersList(env)) };
}

async function memberPreview(env, b) {
  const m = await env.DB.prepare("SELECT code, name FROM members WHERE code = ?").bind(String(b.code || "")).first();
  if (!m) throw new HttpError(404, "That member is no longer on the list. Refresh the page.");
  const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 120) || m.name;
  const code = String(b.newCode || "").replace(/\s+/g, "").toUpperCase() || m.code;
  const h = await env.DB.prepare("SELECT SUM(old_name IS NOT new_name OR old_code != code) AS fixed, SUM(old_code != code) AS moved FROM member_changes WHERE code = ?").bind(m.code).first();
  const moved = code !== m.code || !!h.moved;
  const fix = name !== m.name || moved || h.fixed ? { codeChanged: moved } : null;
  const r = mail.memberCode({ code, name }, env.SITE_URL, closeLabel(await closesAt(env)), fix);
  return { subject: r.subject, html: r.html };
}

async function reminderStatus(env) {
  const [waiting, reminded] = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM (${WAITING_SQL})`),
    env.DB.prepare("SELECT COUNT(*) AS n FROM email_log WHERE kind = 'answers_reminder' AND ok = 1"),
  ]);
  const close = await closesAt(env);
  const w = waiting.results[0].n;
  const { sent24h, room } = await dailyRoom(env);
  return {
    waiting: w,
    reminded: reminded.results[0].n,
    sent24h,
    batch: Math.min(w, REMINDER_BATCH, room),
    dailySafe: DAILY_SAFE,
    closed: Date.now() >= Date.parse(close),
    closeDate: closeLabel(close),
  };
}

async function reminderPreview(env) {
  const close = closeLabel(await closesAt(env));
  const m = mail.answersReminder({ name: "Ada Obi", ticket_ref: "QLV26-000" }, `${env.SITE_URL}?answer=example`, close);
  return { subject: m.subject, html: m.html };
}

async function sendReminders(env) {
  const st = await reminderStatus(env);
  if (st.closed) throw new HttpError(409, "Answers have closed, so there is nothing to remind people about.");
  if (!st.waiting) throw new HttpError(409, "Everyone with a ticket has either answered or been reminded already.");
  if (!st.batch) throw new HttpError(409, `${st.sent24h} emails have gone out in the last 24 hours, which is the safe limit on the free plan. Try again tomorrow.`);
  const rows = (await env.DB.prepare(`${WAITING_SQL} LIMIT ?`).bind(st.batch).all()).results;
  const msgs = rows.map((t) => ({ ref: t.reg_ref, to: t.email, ...mail.answersReminder(t, ticketLinks(env, t).answer, st.closeDate) }));
  await sendBatch(env, msgs, "answers_reminder");
  return { sent: rows.length, ...(await reminderStatus(env)) };
}

async function answerList(env) {
  const { results } = await env.DB.prepare("SELECT branch, a1, a2, a3, created_at FROM answers ORDER BY created_at DESC").all();
  return { answers: results, titles: Object.fromEntries(Object.entries(QBANK).map(([k, v]) => [k, { title: v.title, q: v.q.map((q) => q.t) }])) };
}

// ---------- CSV ----------

function cell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheets running it as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(rows, cols) {
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
}
async function exportCsv(env, name) {
  let body;
  if (name === "registrations.csv") {
    const { results } = await env.DB.prepare("SELECT * FROM registrations WHERE tier != 'partner' ORDER BY created_at").all();
    body = csv(results.map((r) => ({ ...r, flagged_for_release: flagged(r) ? "yes" : "", proof_uploaded: r.proof_at ? "yes" : "no" })),
      ["ref", "status", "tier", "size", "amount", "name", "contact_person", "email", "phone", "organisation", "member_no", "role", "invited_by", "mode", "named_publicly",
        "proof_uploaded", "created_at", "proof_at", "verified_at", "sent_at", "queried_at", "released_at", "query_note", "flagged_for_release"]);
  } else if (name === "tickets.csv") {
    const { results } = await env.DB.prepare("SELECT t.ticket_ref, t.reg_ref, t.kind, t.seat_no, t.name, t.email, t.phone, t.role, t.sent_at, r.organisation FROM tickets t JOIN registrations r ON r.ref = t.reg_ref WHERE t.ticket_ref != 'pending' AND t.cancelled_at IS NULL ORDER BY t.id").all();
    body = csv(results, ["ticket_ref", "reg_ref", "kind", "seat_no", "name", "email", "phone", "role", "organisation", "sent_at"]);
  } else if (name === "money.csv") {
    body = csv(await money.moneyRows(env), money.MONEY_COLS);
  } else if (name === "answers.csv") {
    // No names, no references: the promise on the questions screen.
    const { results } = await env.DB.prepare("SELECT branch, a1, a2, a3, created_at FROM answers ORDER BY created_at").all();
    body = csv(results.map((r) => ({ ...r, created_on: r.created_at.slice(0, 10) })), ["branch", "a1", "a2", "a3", "created_on"]);
  } else throw new HttpError(404, "No such export.");
  return new Response(body, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="qlv2026-${name}"`, ...SECURITY },
  });
}

async function proof(env, ref) {
  const { value, metadata } = await env.KV.getWithMetadata(`proof:${String(ref)}`, { type: "arrayBuffer" });
  if (!value) throw new HttpError(404, "No proof uploaded.");
  const ext = metadata.type === "application/pdf" ? "pdf" : metadata.type === "image/png" ? "png" : "jpg";
  return new Response(value, {
    headers: { "content-type": metadata.type, "content-disposition": `inline; filename="${ref}.${ext}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" },
  });
}

// ---------- pages ----------

const STYLE = `
body.board .wrap .btn,body.board .wrap button.link,body.board .wrap .actions,body.board .wrap .switch,body.board .wrap input[type=file],body.board .wrap form button,
body.board .wrap [data-act],body.board .wrap a[href^="/admin/"],body.board #stageView button,body.board #checkinView button,body.board #scoringView button,
body.board #tablesView button,body.board #exportView button,body.board #pNote,body.board #pDetail .note,body.board #partnersView form,body.board #staffView form,body.board #screenView form{display:none!important}
body.board #stDemo{display:inline-flex!important}
body.board .wrap input:disabled,body.board .wrap select:disabled,body.board .wrap textarea:disabled{opacity:1;color:var(--ink);background:#F4F7FB;cursor:default}
:root{--navy:${THEME.primary};--blue:#1A5AA8;--teal:#1F7D87;--yel:${THEME.accent};--ink:#0E1B33;--body:#4A5B75;--mute:#5A6B85;--line:#E0E8F2;--rule:#C6D4E6;--panel:#F4F8FC;--bg:#F4F7FB}
*{box-sizing:border-box}body{margin:0;font-family:Poppins,Arial,sans-serif;background:var(--bg);color:var(--ink);font-size:13px}
a{color:#14478F}h1{font-size:20px;margin:0}h2{font-size:16px;margin:0 0 10px}
.top{background:var(--navy);color:#fff;padding:12px 20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.top a,.top button{color:#fff}.top .who{font-size:11px;color:#CFE0F3}
.wrap{max-width:1280px;margin:0 auto;padding:18px 16px 60px}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px}
.btn{font-family:inherit;font-size:13px;font-weight:600;color:#fff;background:var(--navy);border:0;border-radius:7px;padding:10px 16px;cursor:pointer;min-height:40px}
.btn.ghost{background:#fff;color:var(--navy);border:1.5px solid var(--navy)}.btn.gold{background:var(--yel);color:var(--navy)}.btn.teal{background:var(--teal)}
.btn.warn{background:#fff;color:#8A2A20;border:1.5px solid #C9776D}.btn[disabled]{opacity:.5;cursor:progress}
.link{background:none;border:0;padding:0;font:inherit;font-weight:600;color:#14478F;cursor:pointer;text-decoration:underline}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.chips button{font-family:inherit;font-size:12px;font-weight:600;border:1px solid var(--rule);background:#fff;border-radius:999px;padding:7px 12px;cursor:pointer;color:var(--body)}
.chips button.on{background:var(--navy);border-color:var(--navy);color:#fff}
.tabs{display:flex;gap:16px;margin:0 0 14px;border-bottom:1px solid var(--line)}.tabs button{font:inherit;font-weight:600;background:none;border:0;border-bottom:3px solid transparent;padding:8px 2px;cursor:pointer;color:var(--body)}.tabs button.on{color:var(--navy);border-color:var(--yel)}
.grid{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}.list{flex:3 1 560px;min-width:0}.side{flex:2 1 420px;min-width:0;position:sticky;top:12px}
table{width:100%;border-collapse:collapse;background:#fff}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:10px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mute);font-weight:700}tbody tr{cursor:pointer}tbody tr:hover{background:var(--panel)}tbody tr.sel{background:#FFF8E2}
.mono{font-family:'IBM Plex Mono',Consolas,monospace;font-weight:600;color:var(--navy)}
.st{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 7px;border-radius:4px;white-space:nowrap;display:inline-block}
.st.awaiting{background:#FFF3CF;color:#6B5A1E}.st.verified{background:#E4ECF8;color:var(--navy)}.st.confirmed{background:#E2F2F2;color:#19646D}.st.queried{background:#FBEDEB;color:#8A2A20}.st.released{background:#EEF0F3;color:var(--mute)}
.flag{font-size:10px;font-weight:700;color:#8A2A20}
dl{display:grid;grid-template-columns:150px minmax(0,1fr);gap:6px 12px;margin:0 0 14px}dt{color:var(--mute);font-size:11px}dd{margin:0;overflow-wrap:anywhere}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.note{background:var(--panel);border-radius:8px;padding:12px 14px;font-size:12px;color:var(--body);line-height:1.6;margin:10px 0}
.proof img{max-width:100%;border:1px solid var(--line);border-radius:6px;display:block}
iframe{width:100%;height:560px;border:1px solid var(--line);border-radius:8px;background:#E3EBF4}
textarea,input[type=email],input[type=text]{width:100%;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:10px 12px;min-height:42px}textarea{min-height:90px}
.msg{padding:10px 12px;border-radius:7px;margin:10px 0;font-size:12px}.msg.err{background:#FBEDEB;color:#8A2A20}.msg.ok{background:#E2F2F2;color:#19646D}
.small{font-size:11px;color:var(--mute)}.hr{height:1px;background:var(--line);margin:14px 0}
.ans{border-bottom:1px solid var(--line);padding:12px 0}.ans p{margin:4px 0;line-height:1.6}.ans b{font-size:11px;color:var(--blue)}
@media(max-width:700px){dl{grid-template-columns:minmax(0,1fr)}.side{position:static}.hide-s{display:none}}
`;

function page(title, body, script = "") {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${e(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Poppins:wght@400;600;700&display=swap"><style>${STYLE}${VIEWS_STYLE}${P2_STYLE}</style></head><body>${body}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

function loginPage(note, boardNote) {
  return page("Sign in | QLV 2026 admin", `<div class="top"><b>QLV 2026 admin</b></div><div class="wrap" style="max-width:460px">
  <div class="card"><h1>Sign in</h1><p class="small" style="margin:6px 0 14px">Enter your admin email. We send a one-time sign-in link to it.</p>
  ${note ? `<div class="msg ok">${e(note)}</div>` : ""}
  <form method="post" action="/admin/login"><input type="email" name="email" required autocomplete="email" placeholder="you@example.com"><div class="actions"><button class="btn">Email me a link</button></div></form></div>
  <div class="card"><h2>Board view</h2><p class="small" style="margin:6px 0 14px">For JCI Aso board members. Type the passcode you were given to look round the admin. It is read only.</p>
  ${boardNote ? `<div class="msg err">${e(boardNote)}</div>` : ""}
  <form method="post" action="/admin/board"><input type="text" name="passcode" required autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="word-word-word-word"><div class="actions"><button class="btn ghost">Open the board view</button></div></form></div></div>`);
}
function continuePage(t) {
  return page("Continue | QLV 2026 admin", `<div class="top"><b>QLV 2026 admin</b></div><div class="wrap" style="max-width:460px">
  <div class="card"><h1>Nearly there</h1><p class="small" style="margin:6px 0 14px">Press continue to finish signing in. The link works once.</p>
  <form method="post" action="/admin/auth"><input type="hidden" name="t" value="${e(t)}"><button class="btn">Continue</button></form></div></div>`);
}

const APP = String.raw`
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const naira = (n) => "₦" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const when = (s) => s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";
const TIER = { standard: "Standard", member: "Member", corporate: "Corporate", sponsored: "Sponsored", adviser: "Adviser" };
const STATUS = { awaiting: "Awaiting", verified: "Verified, not sent", confirmed: "Confirmed", queried: "Queried", released: "Released" };
let filter = ROLE === "board" ? "all" : "awaiting", current = null, tab = "regs";

async function call(path, body) {
  const opts = body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json", "x-admin": "1" }, body: JSON.stringify(body) };
  const res = await fetch("/admin/api/" + path, { credentials: "same-origin", ...opts });
  if (res.status === 401) { location.href = "/admin"; throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function msg(text, ok) { const m = $("#msg"); m.className = "msg " + (ok ? "ok" : "err"); m.textContent = text; m.hidden = !text; }

async function loadList() {
  const d = await call("list?status=" + filter);
  const labels = { awaiting: "Awaiting", flagged: "Flagged for release", verified: "Verified, not sent", queried: "Queried", confirmed: "Confirmed", released: "Released", all: "All", adviser: "Advisers" };
  if (ROLE === "verifier") { delete labels.flagged; delete labels.adviser; delete labels.released; }
  $("#chips").innerHTML = Object.keys(labels).map((k) => '<button data-f="' + k + '" class="' + (k === filter ? "on" : "") + '">' + labels[k] + " (" + d.counts[k] + ")</button>").join("");
  const day = new Date(Date.parse(d.closesAt) + 3600000 - 60000).toISOString().slice(0, 10);
  if ($("#closeDate")) {
    if (document.activeElement !== $("#closeDate")) $("#closeDate").value = day;
    $("#closeState").textContent = d.closed ? "Registration is closed." : "Registration is open.";
    $("#closeState").style.color = d.closed ? "#8A2A20" : "#19646D";
  }
  $("#flagNote").hidden = ROLE === "verifier" || ROLE === "board";
  $("#flagNote").textContent = "Flagged means still awaiting " + d.releaseAfterDays + " days after registering. Nothing is released until you press Release.";
  $("#rows").innerHTML = d.rows.map((r) => '<tr data-ref="' + esc(r.ref) + '" class="' + (current && current.reg.ref === r.ref ? "sel" : "") + '">' +
    '<td class="mono">' + esc(r.ref) + "</td><td>" + esc(r.contact_person ? r.name + " (" + r.contact_person + ")" : r.name) + '<div class="small">' + esc(r.email) + "</div></td>" +
    "<td>" + TIER[r.tier] + (r.tier === "corporate" ? " of " + r.size : r.size > 1 ? " x" + r.size + (r.shares && r.status === "confirmed" ? ", " + r.claimed + " claimed" : "") : "") + "</td>" +
    "<td>" + (r.amount ? naira(r.amount) : "None") + '</td><td class="hide-s">' + (r.tier === "adviser" ? "" : r.proof_at ? "Yes" : '<span class="small">Not yet</span>') + '</td><td class="hide-s">' + when(r.created_at) + "</td>" +
    '<td><span class="st ' + r.status + '">' + STATUS[r.status] + "</span>" + (r.flagged ? '<div class="flag">Flagged for release</div>' : "") + "</td></tr>").join("") ||
    '<tr><td colspan="7" class="small">Nothing here.</td></tr>';
}

function people(d) {
  const r = d.reg;
  if (r.attendees) return '<div class="hr"></div><h2>Attendees</h2>' + r.attendees.map((a, i) => "<div>" + (a.judge ? "<b>Judge or mentor:</b> " : (i + 1) + ". ") + esc(a.name) + ", " + esc(a.email) + (a.role ? ", " + esc(a.role) : "") + "</div>").join("");
  return "";
}
function ticketRows(d) {
  if (!d.tickets.length) return "";
  return '<div class="hr"></div><h2>' + (d.reg.shares ? (d.reg.tier === "sponsored" ? "Claimed seats" : "Claimed places") : "Tickets") + "</h2>" + d.tickets.map((t) =>
    '<div style="margin:0 0 8px"><span class="mono">' + esc(t.ticket_ref) + "</span> " + esc(t.name) + ", " + esc(t.email) +
    ' <span class="small">' + (t.kind === "judge" ? "judge or mentor, " : "") + (t.cancelled_at ? "<b>cancelled</b>" : t.sent_at ? "sent " + when(t.sent_at) : "not sent") + (t.table && ROLE === "admin" ? ", " + esc(t.table) : "") + "</span>" +
    (t.sent_at && !t.cancelled_at && ROLE === "admin" ? ' <button class="link" data-resend="' + t.id + '" data-email="' + esc(t.email) + '">Resend</button> <button class="link" data-cancel="' + t.id + '" data-name="' + esc(t.name) + '">Cancel ticket</button>' : "") +
    (t.replaceable && ROLE === "admin" ? ' <button class="link" data-replace="' + t.id + '" data-name="' + esc(t.name) + '">Give this seat to someone else</button>' : "") + "</div>").join("");
}

function renderDetail(d) {
  current = d;
  const r = d.reg;
  const rows = [["Reference", '<span class="mono">' + esc(r.ref) + "</span>"], ["Status", '<span class="st ' + r.status + '">' + STATUS[r.status] + "</span>" + (r.flagged ? ' <span class="flag">Flagged for release</span>' : "")],
    ["Ticket", esc(r.tierName) + (r.tier === "corporate" ? ", team of " + r.size : r.tier === "sponsored" ? ", " + r.size + " seats" : r.size > 1 ? " x" + r.size + (r.shares ? ", link to share" : ", named below") : "")], ["Amount", r.amount ? esc(r.amountText) : "None"],
    [r.tier === "sponsored" ? "Sponsor" : r.tier === "corporate" ? "Organisation" : "Name", esc(r.name)]];
  if (r.contact_person) rows.push(["Contact person", esc(r.contact_person)]);
  if (ROLE === "board") rows.push(["Email and phone", '<span class="small">Hidden in the board view</span>']);
  else rows.push(["Email", '<a href="mailto:' + esc(r.email) + '">' + esc(r.email) + "</a>"]);
  if (r.phone && ROLE !== "board") rows.push(["Phone", '<a href="tel:' + esc(r.phone) + '">' + esc(r.phone) + "</a>"]);
  if (r.organisation && r.tier !== "corporate") rows.push(["Organisation", esc(r.organisation)]);
  if (r.tier === "member") rows.push(["Member code", '<span class="mono">' + esc(r.member_no || "") + "</span> (checked against the member list)"]);
  if (r.tier === "sponsored") rows.push(["Name publicly", r.named_publicly ? "Yes" : "No, anonymous"]);
  if (r.tier === "adviser") rows.push(["Role", esc(r.role)], ["Invited by", esc(r.invited_by)], ["Taking part as", { both: "Adviser and judge", judge: "Judge only", adviser: "Adviser only" }[r.mode]]);
  rows.push(["Registered", when(r.created_at)]);
  if (r.proof_at) rows.push(["Proof uploaded", when(r.proof_at)]);
  if (r.query_note && r.status === "queried") rows.push(["Query sent", esc(r.query_note)]);
  if (d.claimUrl) rows.push(["Claim link", '<span class="small" style="word-break:break-all">' + esc(d.claimUrl) + "</span>"]);

  let proof = "";
  if (r.tier !== "adviser" && ROLE === "board") {
    proof = '<div class="hr"></div><h2>Proof of payment</h2><p class="small">' + (r.proof_at ? "Uploaded. Proofs are seen only by the verification team." : "Nothing uploaded yet.") + "</p>";
  } else if (r.tier !== "adviser") {
    proof = '<div class="hr"></div><h2>Proof of payment</h2>' + (!r.proof_at ? '<p class="small">Nothing uploaded yet.</p>'
      : r.proof_type === "application/pdf" ? '<p><a target="_blank" rel="noopener" href="/admin/proof?ref=' + encodeURIComponent(r.ref) + '">Open the PDF</a></p>'
      : '<div class="proof"><a target="_blank" rel="noopener" href="/admin/proof?ref=' + encodeURIComponent(r.ref) + '"><img alt="Proof of payment for ' + esc(r.ref) + '" src="/admin/proof?ref=' + encodeURIComponent(r.ref) + '"></a></div>');
  }

  let actions = "";
  if (r.verified_by && r.status !== "awaiting") rows.push(["Verified by", esc(r.verified_by) + (r.verified_at ? ", " + when(r.verified_at) : "")]);
  if (ROLE === "verifier") {
    if (r.status === "awaiting" || r.status === "queried") {
      actions = '<div class="note">Look on the FCMB statement for <b>' + esc(r.amountText) + '</b> with narration <b class="mono">' + esc(r.ref) + "</b>." +
        (!r.proof_at ? " <b>No proof has been uploaded.</b>" : " Their proof of payment is below.") + "</div>" +
        '<div class="actions"><button class="btn teal" data-act="verify">Payment verified</button></div>' +
        '<p class="small">Cannot find the transfer? Send the reference to Hadeezah and she will contact the person.</p>';
    } else if (r.status === "verified") {
      actions = '<div class="note">Payment verified. Hadeezah sends the tickets.</div>' +
        (r.verified_by === ME ? '<div class="actions"><button class="btn ghost" data-act="unverify">Undo verification</button></div>' : "");
    }
  } else if (r.status === "awaiting" || r.status === "queried") {
    actions = '<div class="note">Check the transfer for <b>' + esc(r.amountText) + '</b> with narration <b class="mono">' + esc(r.ref) + "</b> on the statement." +
(!r.proof_at ? " <b>No proof has been uploaded.</b>" : "") + "</div>" +
      '<div class="actions"><button class="btn teal" data-act="verify">Payment verified</button><button class="btn ghost" data-act="queryOpen">Query</button><button class="btn warn" data-act="release">Release seat</button></div>' +
      '<div id="queryBox" hidden><textarea id="queryNote" placeholder="What is missing or what to check. This text goes into the email."></textarea>' +
      '<div class="actions"><button class="btn ghost" data-act="queryPreview">Preview email</button><button class="btn" data-act="query">Send query email</button></div><div id="queryFrame"></div></div>';
  } else if (r.status === "verified") {
    const what = r.shares ? (r.tier === "sponsored" ? "the claim link email" : "the email with the link to share") : d.tickets.length + (d.tickets.length === 1 ? " ticket" : " tickets") + (r.tier === "corporate" ? " and the receipt to the billing contact" : r.size > 1 ? " and the receipt to the buyer" : "");
    actions = '<div class="note">Verified. Nothing has been sent yet. Check ' + what + ' below, then press Send.</div>' +
      '<div class="actions"><button class="btn gold" data-act="send">' + (r.shares ? (r.tier === "sponsored" ? "Send claim link" : "Send link to share") : "Send tickets") + '</button><button class="btn ghost" data-act="unverify">Undo verification</button></div><div id="previews"><p class="small">Loading previews…</p></div>';
  } else if (r.status === "released") {
    actions = '<div class="actions"><button class="btn ghost" data-act="reopen">Reopen</button></div>';
  }

  $("#detail").innerHTML = '<div class="card"><h1 style="margin-bottom:12px">' + esc(r.ref) + "</h1><dl>" + rows.map((x) => "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>").join("") + "</dl>" +
    actions + people(d) + ticketRows(d) + proof +
    (d.log.length ? '<div class="hr"></div><h2>Emails</h2>' + d.log.map((l) => '<div class="small">' + when(l.created_at) + ", " + esc(l.kind.replace(/_/g, " ")) + " to " + esc(l.recipient) + (l.ok ? "" : ' <b style="color:#8A2A20">failed</b>') + "</div>").join("") : "") + "</div>";
  if (r.status === "verified" && ROLE === "admin") loadPreviews(r.ref);
  document.querySelectorAll("#rows tr").forEach((tr) => tr.classList.toggle("sel", tr.dataset.ref === r.ref));
}

async function loadPreviews(ref) {
  try {
    const list = await call("preview?ref=" + encodeURIComponent(ref));
    const box = $("#previews");
    box.innerHTML = list.map((m, i) => '<div style="margin:12px 0 4px"><b>To:</b> ' + esc(m.to) + '<div class="small">' + esc(m.subject) + '</div></div><iframe sandbox="" title="Email preview ' + (i + 1) + '" id="pv' + i + '"></iframe>').join("");
    list.forEach((m, i) => { $("#pv" + i).srcdoc = m.html; });
  } catch (err) { msg(err.message); }
}

async function openReg(ref) {
  msg("");
  try { renderDetail(await call("reg?ref=" + encodeURIComponent(ref))); if (innerWidth < 900) $("#detail").scrollIntoView(); } catch (err) { msg(err.message); }
}

async function act(name, btn) {
  const ref = current.reg.ref;
  const confirmText = { send: "Send these emails now?", release: "Release " + ref + "? The registrant is not emailed. You can reopen it later.", unverify: "Undo the verification? The unsent tickets are deleted.", query: "Send the query email to " + current.reg.email + "?" };
  if (name === "queryOpen") { $("#queryBox").hidden = false; $("#queryNote").focus(); return; }
  if (confirmText[name] && !confirm(confirmText[name])) return;
  btn.disabled = true;
  msg("");
  try {
    if (name === "queryPreview") {
      const m = await call("query-preview", { ref, note: $("#queryNote").value });
      $("#queryFrame").innerHTML = '<iframe sandbox="" title="Query email preview" id="qf"></iframe>';
      $("#qf").srcdoc = m.html;
      btn.disabled = false;
      return;
    }
    const body = name === "query" ? { ref, note: $("#queryNote").value } : { ref };
    const d = await call(name, body);
    if (d.failed && d.failed.length) msg("These did not send: " + d.failed.join(", ") + ". Press Send again to retry just those.");
    else if (name === "verify" && ROLE === "verifier") msg(current.reg.ref + " marked as verified. Hadeezah will send the tickets.", true);
    else msg({ verify: "Tickets made. Nothing sent yet: check the previews.", send: "Sent.", query: "Query email sent.", release: "Released.", unverify: "Verification undone.", reopen: "Reopened." }[name] || "Done.", true);
    renderDetail(d);
    loadList();
  } catch (err) { msg(err.message); btn.disabled = false; }
}

async function resend(btn) {
  const email = prompt("Send this ticket to which email? Change it if it was mistyped.", btn.dataset.email);
  if (!email) return;
  try { renderDetail(await call("resend-ticket", { id: Number(btn.dataset.resend), email })); msg("Ticket sent to " + email + ".", true); } catch (err) { msg(err.message); }
}

// A cancelled corporate or group seat goes to a new person: new ticket, same seat.
async function replaceSeat(btn) {
  const name = prompt("Who gets " + btn.dataset.name + "'s seat? Their full name, as it should read on the ticket.");
  if (!name || !name.trim()) return;
  const email = prompt("Their email. The ticket goes straight there.");
  if (!email || !email.trim()) return;
  if (!confirm("Give this seat to " + name.trim() + " (" + email.trim() + ") and email them their ticket now?")) return;
  try {
    const d = await call("replace-ticket", { id: Number(btn.dataset.replace), name, email });
    renderDetail(d); msg(d.sent === false ? "Seat given to " + name.trim() + ", but the email did not send. Use Resend on their ticket." : "Seat given to " + name.trim() + ". Their ticket has been emailed.", d.sent !== false);
  } catch (err) { msg(err.message); }
}

async function loadCodes() {
  const r = await call("codes");
  let state;
  if (r.closed) state = "Registration has closed, so sending is off.";
  else if (!r.waiting) state = "Nobody is waiting: every member with an email has been sent their code or has already registered.";
  else if (!r.batch) state = r.sent24h + " emails have gone out in the last 24 hours, the safe limit on the free plan. The next batch can go tomorrow.";
  else state = "The next batch is " + r.batch + (r.batch === 1 ? " member." : " members.") + (r.batch < r.waiting ? " Press again tomorrow for the rest." : "");
  $("#codesBox").innerHTML = '<h2>Email each member their code</h2>' +
    '<p class="small" style="margin:0 0 6px"><b>' + r.waiting + '</b> waiting. ' + r.withEmail + ' of ' + r.members + ' members have an email on file; ' + r.sent + ' sent so far. ' +
    r.sent24h + ' of the ' + r.dailySafe + ' emails a day kept for the free plan used in the last 24 hours.</p>' +
    '<p class="small" style="margin:0">' + esc(state) + ' Each member gets only their own code, once. Members who have already registered are skipped.</p>' +
    '<div class="actions"><button class="btn ghost" data-codes="preview">Preview the email</button>' +
    '<button class="btn gold" data-codes="send"' + (r.batch && !r.closed ? "" : " disabled") + '>Send codes' + (r.batch ? " (" + r.batch + ")" : "") + '</button></div><div id="codesFrame"></div>';
  $("#codesBox").dataset.batch = r.batch;
}

let members = [], mbCur = null, mbCodeTouched = false;
const initials = (n) => (String(n).match(/[A-Za-z][A-Za-z'-]*/g) || []).map((w) => w[0]).join("").toUpperCase();
const digits = (c) => (String(c).match(/\d{3}$/) || [""])[0];
async function loadMembers(d) {
  const r = d || await call("members");
  members = r.members; $("#mbRows").dataset.closed = r.closed ? "1" : "";
  drawMembers();
  if (mbCur) { const m = members.find((x) => x.code === mbCur); if (m) openMember(m.code); else mbCur = null; }
}
function mbStatus(m) {
  if (m.reg_ref) return '<span class="st confirmed">Registered</span>';
  if (!m.email) return '<span class="st released">No email</span>';
  return m.sent_at ? '<span class="st verified">Code sent</span>' : '<span class="st awaiting">Not sent</span>';
}
function drawMembers() {
  const q = $("#mbFind").value.trim().toLowerCase();
  const rows = members.filter((m) => !q || (m.code + " " + m.name + " " + (m.email || "") + " " + (m.old_codes || "")).toLowerCase().includes(q));
  $("#mbRows").innerHTML = rows.map((m) => '<tr data-mb="' + esc(m.code) + '"' + (m.code === mbCur ? ' class="sel"' : "") + '><td class="mono">' + esc(m.code) + "</td><td><b>" + esc(m.name) + "</b>" +
    (m.changed_at ? '<div class="small">Corrected ' + when(m.changed_at) + (m.old_codes ? ", was " + esc(m.old_codes) : "") + "</div>" : "") + '</td><td class="hide-s small">' + esc(m.email || "") + "</td><td>" + mbStatus(m) + "</td></tr>").join("") ||
    '<tr><td colspan="4" class="small">No member matches that search.</td></tr>';
}
function openMember(code) {
  const m = members.find((x) => x.code === code);
  if (!m) return;
  mbCur = code; mbCodeTouched = false;
  document.querySelectorAll("#mbRows tr").forEach((tr) => tr.classList.toggle("sel", tr.dataset.mb === code));
  const closed = $("#mbRows").dataset.closed === "1";
  $("#mbSide").innerHTML = '<form class="card" id="mbForm"><h2>' + esc(m.name) + '</h2><p class="small" style="margin:0 0 12px">Code <b class="mono">' + esc(m.code) + "</b>" +
    (m.old_codes ? " · earlier code " + esc(m.old_codes) + " still works" : "") + (m.sent_at ? " · code last emailed " + when(m.sent_at) : "") + "</p>" +
    '<label class="fl">Full name, spelled and ordered correctly<input type="text" name="name" maxlength="120" value="' + esc(m.name) + '"></label>' +
    '<label class="fl">Code<input type="text" name="newCode" maxlength="12" class="mono" value="' + esc(m.code) + '" autocapitalize="characters"></label>' +
    '<p class="small" id="mbCodeNote" style="margin:-4px 0 10px"></p>' +
    '<label class="fl">Email<input type="email" name="email" maxlength="160" value="' + esc(m.email || "") + '" placeholder="No email on file yet"></label>' +
    (m.reg_ref
      ? '<div class="note">Already registered as <b class="mono">' + esc(m.reg_ref) + '</b>. Saving puts the corrected name on their registration and ticket; the ticket number stays the same. No code email goes out. To send them the corrected ticket, open ' + esc(m.reg_ref) + ' in Registrations and use Resend.</div>'
      : closed ? '<div class="note">Registration has closed, so no code email can go out. The correction is still saved.</div>'
      : '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;margin:4px 0 6px"><input type="checkbox" name="send"' + (m.email ? " checked" : "") + ' style="margin-top:3px"> <span id="mbSendLabel">Email them the code now</span></label><p class="small" style="margin:0 0 6px">The email thanks them for letting us know and asks them to use the new code.</p>') +
    '<div class="actions"><button class="btn" id="mbSave">Save correction</button><button type="button" class="btn ghost" id="mbPreview"' + (m.reg_ref || closed ? " hidden" : "") + '>Preview the email</button></div><div id="mbFrame"></div></form>';
  mbNote();
}
function mbNote() {
  const f = $("#mbForm"), m = members.find((x) => x.code === mbCur);
  if (!f || !m) return;
  const want = initials(f.name.value) + digits(m.code);
  if (!mbCodeTouched) f.newCode.value = want;
  const code = f.newCode.value.replace(/\s+/g, "").toUpperCase();
  if (f.send) {
    const has = /@/.test(f.email.value);
    if (!has) f.send.checked = false;
    f.send.disabled = !has;
    $("#mbSendLabel").textContent = has ? "Email them the code now" : "Add an email above to send them the code";
  }
  const send = f.send && f.send.checked;
  $("#mbCodeNote").textContent = code === m.code ? "The code stays " + m.code + "." : "The code changes from " + m.code + " to " + code + ". " + m.code + " will still be accepted." + (code !== want ? " This does not match the initials, " + want + "." : "");
  $("#mbSave").textContent = send ? (code === m.code && f.name.value.trim() === m.name ? "Save and email the code" : "Save and email the corrected code") : "Save correction";
}
async function saveMember(f) {
  const m = members.find((x) => x.code === mbCur);
  const body = { code: m.code, name: f.name.value, newCode: f.newCode.value, email: f.email.value, send: !!(f.send && f.send.checked) };
  const what = body.send ? " and email the code to " + body.email : "";
  if (!confirm("Save " + body.name.trim() + " with code " + body.newCode.trim().toUpperCase() + what + "?")) return;
  $("#mbSave").disabled = true;
  try {
    const r = await call("member-fix", body);
    mbCur = r.code; await loadMembers(r);
    if (r.warning) msg(r.warning);
    else msg("Saved " + r.name + " as " + r.code + "." + (r.emailed ? " The code has gone to " + r.email + "." : "") + (r.reg ? " Their registration " + r.reg.ref + " and ticket now show the corrected name." : ""), true);
  } catch (err) { msg(err.message); loadMembers().catch(() => {}); }
}

async function mbPreview() {
  const f = $("#mbForm");
  const r = await call("member-preview", { code: mbCur, name: f.name.value, newCode: f.newCode.value });
  $("#mbFrame").innerHTML = '<div class="small" style="margin:6px 0">' + esc(r.subject) + '</div><iframe sandbox="" title="Corrected code email preview" id="mbPv"></iframe>';
  $("#mbPv").srcdoc = r.html;
}
document.addEventListener("input", (e) => {
  if (e.target.id === "mbFind") drawMembers();
  if (e.target.closest("#mbForm")) { if (e.target.name === "newCode") mbCodeTouched = true; mbNote(); }
});
document.addEventListener("change", (e) => { if (e.target.closest("#mbForm") && e.target.name === "send") mbNote(); });
document.addEventListener("submit", (e) => { if (e.target.id === "mbForm") { e.preventDefault(); saveMember(e.target); } });

async function codes(kind, btn) {
  msg("");
  if (kind === "preview") {
    const m = await call("codes-preview");
    $("#codesFrame").innerHTML = '<div class="small" style="margin:6px 0">' + esc(m.subject) + ' (shown with a sample name and code)</div><iframe sandbox="" title="Member code email preview" id="codesPv"></iframe>';
    $("#codesPv").srcdoc = m.html;
    return;
  }
  const n = Number($("#codesBox").dataset.batch || 0);
  if (!n || !confirm("Email " + n + (n === 1 ? " member their code?" : " members their codes?"))) return;
  btn.disabled = true;
  try { const r = await call("codes", {}); msg("Codes sent to " + r.sent + (r.sent === 1 ? " member." : " members."), true); }
  catch (err) { msg(err.message); }
  loadCodes();
}

async function loadReminders() {
  const r = await call("reminders");
  const box = $("#remind");
  let state;
  if (r.closed) state = "Answers have closed, so reminders are off.";
  else if (!r.waiting) state = "Nobody is waiting for a reminder: everyone with a ticket has answered or already been reminded.";
  else if (!r.batch) state = r.sent24h + " emails have gone out in the last 24 hours, the safe limit on the free plan. The next batch can go tomorrow.";
  else state = "The next batch is " + r.batch + (r.batch === 1 ? " person." : " people.") + (r.batch < r.waiting ? " Press again tomorrow for the rest." : "");
  box.innerHTML = '<h2>Remind people to send their three answers</h2>' +
    '<p class="small" style="margin:0 0 6px"><b>' + r.waiting + '</b>' + (r.waiting === 1 ? ' ticket holder has' : ' ticket holders have') + ' not answered and not been reminded. ' + r.reminded + ' reminded so far. ' +
    r.sent24h + ' of the ' + r.dailySafe + ' emails a day kept for the free plan used in the last 24 hours.</p>' +
    '<p class="small" style="margin:0">' + esc(state) + ' Each person is reminded once. Judges, advisers and sponsors are not included. Answers close on ' + esc(r.closeDate) + '.</p>' +
    '<div class="actions"><button class="btn ghost" data-rem="preview">Preview the email</button>' +
    '<button class="btn gold" data-rem="send"' + (r.batch && !r.closed ? "" : " disabled") + '>Send next batch' + (r.batch ? " (" + r.batch + ")" : "") + '</button></div><div id="remFrame"></div>';
  box.dataset.batch = r.batch;
}

async function remind(kind, btn) {
  msg("");
  if (kind === "preview") {
    const m = await call("reminder-preview");
    $("#remFrame").innerHTML = '<div class="small" style="margin:6px 0">' + esc(m.subject) + ' (shown with a sample name)</div><iframe sandbox="" title="Reminder preview" id="remPv"></iframe>';
    $("#remPv").srcdoc = m.html;
    return;
  }
  const n = Number($("#remind").dataset.batch || 0);
  if (!n || !confirm("Send the reminder to the next " + n + (n === 1 ? " person" : " people") + "?")) return;
  btn.disabled = true;
  try { const r = await call("reminders", {}); msg("Reminder sent to " + r.sent + (r.sent === 1 ? " person." : " people."), true); }
  catch (err) { msg(err.message); }
  loadReminders();
}

async function loadAnswers() {
  loadReminders().catch((err) => msg(err.message));
  const d = await call("answers");
  const by = {};
  d.answers.forEach((a) => { (by[a.branch] = by[a.branch] || []).push(a); });
  $("#answers").innerHTML = '<p class="small">' + d.answers.length + " sets of answers. Names and references are not shown here or in the CSV.</p>" +
    Object.keys(d.titles).map((k) => '<div class="card" style="margin:0 0 14px"><h2>' + esc(d.titles[k].title) + " (" + (by[k] || []).length + ")</h2>" +
      (by[k] || []).map((a) => '<div class="ans">' + [a.a1, a.a2, a.a3].map((x, i) => x ? "<b>" + (i + 1) + ". " + esc(d.titles[k].q[i]) + "</b><p>" + esc(x) + "</p>" : "").join("") + '<div class="small">' + when(a.created_at) + "</div></div>").join("") + "</div>").join("");
}

document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-f]"); if (f) { filter = f.dataset.f; loadList(); return; }
  const tr = e.target.closest("tr[data-ref]"); if (tr) { openReg(tr.dataset.ref); return; }
  const a = e.target.closest("[data-act]"); if (a) { act(a.dataset.act, a); return; }
  const r = e.target.closest("[data-resend]"); if (r) { resend(r); return; }
  const rp = e.target.closest("[data-replace]"); if (rp) { replaceSeat(rp); return; }
  const mb = e.target.closest("tr[data-mb]"); if (mb) { openMember(mb.dataset.mb); return; }
  if (e.target.closest("#mbPreview")) { mbPreview().catch((err) => msg(err.message)); return; }
  const cd = e.target.closest("[data-codes]"); if (cd) { codes(cd.dataset.codes, cd).catch((err) => msg(err.message)); return; }
  const rm = e.target.closest("[data-rem]"); if (rm) { remind(rm.dataset.rem, rm).catch((err) => msg(err.message)); return; }
  const t = e.target.closest("[data-tab]");
  if (t) {
    tab = t.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    $("#regsView").hidden = tab !== "regs"; $("#answersView").hidden = tab !== "answers"; if ($("#codesView")) $("#codesView").hidden = tab !== "codes";
    showView(tab);
    if (tab === "answers") loadAnswers();
    if (tab === "codes") { loadCodes().catch((err) => msg(err.message)); loadMembers().catch((err) => msg(err.message)); }
  }
});
async function saveClosing(btn) {
  const date = $("#closeDate").value;
  if (!date) return;
  const human = new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  if (!confirm("Registration, sponsored claims and new answers will close at the end of " + human + ", Abuja time. Save?")) return;
  btn.disabled = true;
  try { await call("closing", { date, status: filter }); msg("Closing date saved. The page picks it up within a minute.", true); loadList(); }
  catch (err) { msg(err.message); }
  btn.disabled = false;
}
document.addEventListener("click", (e) => { const b = e.target.closest("#saveClose"); if (b) saveClosing(b); });
loadList().catch((err) => msg(err.message));
`;

function appPage(email, role, site) {
  const board = role === "board";
  // The board sees the admin's own screens, read only, minus the tabs that
  // hold the tasks, member codes, answers and sign-in settings.
  const admin = role === "admin" || board;
  const boardTabs = `<div class="tabs"><button data-tab="regs" class="on">Registrations</button><button data-tab="tables">Tables</button><button data-tab="partners">Partners</button><button data-tab="screen">On screen</button><button data-tab="staff">Staff</button><button data-tab="scoring">Scoring</button><button data-tab="stage">Stage</button><button data-tab="checkin">Check-in</button><button data-tab="export">Badge export</button><button data-tab="money">Money</button></div>
    <div class="note" style="margin:0 0 14px">Board view, read only. Emails, phone numbers, proofs of payment and private links are hidden. Nothing here can be changed.</div>`;
  return page("QLV 2026 admin", `<div class="top"><b>QLV 2026 ${board ? "board view" : admin ? "admin" : "payment verification"}</b><span class="who">${board ? "Read only" : `Signed in as ${e(email)}`}
    ${board ? "" : `&middot; <a href="/admin/export/registrations.csv">Registrations CSV</a>`}${role === "admin" ? ` &middot; <a href="/admin/export/tickets.csv">Tickets CSV</a> &middot; <a href="/admin/export/answers.csv">Answers CSV</a>` : ""}
    &middot; <form method="post" action="/admin/logout" style="display:inline"><button class="link" style="color:#fff">Sign out</button></form></span></div>
  <div class="wrap">
    ${!admin ? `<div class="tabs"><button data-tab="regs" class="on">Registrations</button><button data-tab="money">Money</button></div>` : ""}
    ${board ? boardTabs : ""}
    ${role === "admin" ? `<div class="tabs"><button data-tab="regs" class="on">Registrations</button><button data-tab="tables">Tables</button><button data-tab="partners">Partners</button><button data-tab="screen">On screen</button><button data-tab="staff">Staff</button><button data-tab="briefings">Briefings</button><button data-tab="scoring">Scoring</button><button data-tab="stage">Stage</button><button data-tab="lobby">Team rooms</button><button data-tab="checkin">Check-in</button><button data-tab="export">Badge export</button><button data-tab="money">Money</button><button data-tab="answers">Answers</button><button data-tab="codes">Member codes</button><button data-tab="settings">Settings</button><button data-tab="rebalance" hidden>Rebalance</button></div>` : ""}
    <div id="msg" class="msg" hidden role="status"></div>
    ${role === "admin" ? `<div class="card" style="padding:12px 16px;margin:0 0 14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
      <label for="closeDate" style="font-weight:600">Registration closes at the end of</label>
      <input type="date" id="closeDate" min="2026-10-01" max="2026-11-06" style="width:auto;min-height:40px;padding:6px 10px">
      <button class="btn ghost" id="saveClose">Save date</button>
      <span id="closeState" class="small" style="font-weight:600"></span>
      <span class="small">Abuja time. Moves registration, sponsored claims and new answers together. A past date closes it now; a later date reopens it.</span>
    </div>` : ""}
    <div id="regsView"><div id="chips" class="chips"></div><p class="small" id="flagNote" style="margin:-4px 0 12px"></p>
      <div class="grid"><div class="list card" style="padding:0;overflow-x:auto"><table><thead><tr><th>Ref</th><th>Who</th><th>Ticket</th><th>Amount</th><th class="hide-s">Proof</th><th class="hide-s">Registered</th><th>Status</th></tr></thead><tbody id="rows"></tbody></table></div>
      <div class="side" id="detail"><div class="card small">Pick a registration to see its details${board ? "" : " and proof"}.</div></div></div></div>
    ${role === "admin" ? `<div id="codesView" hidden><div class="card" id="codesBox"></div>
      <div class="grid" style="margin-top:14px"><div class="list card" style="padding:0;overflow-x:auto">
        <div style="padding:14px 16px 0"><h2>Correct a member's name, code or email</h2>
          <p class="small" style="margin:0 0 10px">Pick a member to fix how their name is spelled or ordered. Their code follows the corrected initials and keeps its three numbers. The old code keeps working too, because the old list was shared on WhatsApp.</p>
          <input type="search" id="mbFind" placeholder="Search by name, code or email" aria-label="Search members" style="width:100%;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:10px 12px;min-height:42px;margin:0 0 10px"></div>
        <table><thead><tr><th>Code</th><th>Name</th><th class="hide-s">Email</th><th>Status</th></tr></thead><tbody id="mbRows"></tbody></table></div>
      <div class="side" id="mbSide"><div class="card small">Pick a member to correct their details.</div></div></div></div>` : ""}
    ${admin ? VIEWS_HTML + P2_HTML : MONEY_HTML}
    <div id="answersView" hidden><div class="card" id="remind" style="margin:0 0 14px"></div><div id="answers"></div></div>
  </div>`, `const ROLE = ${JSON.stringify(role)}; const ME = ${JSON.stringify(board ? "" : email)}; const SITE = ${JSON.stringify(site)};\n` + APP + (admin ? P2_JS + VIEWS_JS : MONEY_JS + READ_ONLY_VIEWS) + (board ? BOARD_LOCK : ""));
}

// The board view: every field is shown but cannot be edited, and the
// buttons that change things are hidden. The server refuses changes anyway;
// this keeps the page from offering them.
const BOARD_LOCK = String.raw`
document.body.classList.add("board");
const boardLock = () => document.querySelectorAll(".wrap input:not([type=search]), .wrap select, .wrap textarea").forEach((el) => { if (!el.disabled) el.disabled = true; });
new MutationObserver(boardLock).observe(document.querySelector(".wrap"), { childList: true, subtree: true });
boardLock();
`;

// Desk volunteers and stage operators get one tab and nothing else: no
// payments, no personal details beyond name, reference and table.
function oneViewPage(email, role, site) {
  const desk = role === "desk";
  return page(desk ? "QLV 2026 check-in" : "QLV 2026 stage", `<div class="top"><b>QLV 2026 ${desk ? "check-in desk" : "stage"}</b><span class="who">Signed in as ${e(email)}
    &middot; <form method="post" action="/admin/logout" style="display:inline"><button class="link" style="color:#fff">Sign out</button></form></span></div>
  <div class="wrap"><div id="msg" class="msg" hidden role="status"></div>${P2_HTML}</div>`,
  `const ROLE = ${JSON.stringify(role)}; const SITE = ${JSON.stringify(site)};
` + ONE_VIEW_JS + P2_JS + `
document.getElementById(${JSON.stringify(desk ? "checkinView" : "stageView")}).hidden = false;
${desk ? "loadCheckin().catch((err) => msg(err.message)); setInterval(() => { if (!document.hidden && !document.activeElement.matches('#ciFind')) loadCheckin().catch(() => {}); }, 20000);"
       : "loadStage().catch((err) => msg(err.message)); setInterval(() => { if (!document.hidden) loadStage().catch(() => {}); }, 3000);"}`);
}

// ---------- router ----------

async function form(req) {
  const text = await req.text();
  return new URLSearchParams(text.slice(0, 2000));
}

export async function handleAdmin(req, env, ctx, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/admin";
  try {
    if (path === "/admin/login" && req.method === "POST") {
      const email = (await form(req)).get("email")?.trim().toLowerCase() || "";
      const ip = req.headers.get("cf-connecting-ip") || "local";
      const rl = `rl:login:${ip}:${Math.floor(Date.now() / 3600000)}`;
      const n = Number(await env.KV.get(rl)) || 0;
      await env.KV.put(rl, String(n + 1), { expirationTtl: 3700 });
      if (n < 8 && (await roleOf(env, email))) {
        const t = token(32);
        await env.KV.put(`login:${t}`, email, { expirationTtl: 900 });
        await sendMail(env, { to: email, ...mail.adminLogin(`${url.origin}/admin/auth?t=${t}`) }, null, "admin_login");
      }
      return html(loginPage("If that address is on the admin list, a sign-in link is on its way. It expires in 15 minutes."));
    }
    if (path === "/admin/board" && req.method === "POST") {
      const r = await boardLogin(env, req, (await form(req)).get("passcode"));
      if (r.error) return html(loginPage("", r.error), 401);
      return new Response(null, { status: 303, headers: { location: "/admin", "set-cookie": await makeCookie(env, r.id), ...SECURITY } });
    }
    if (path === "/admin/auth" && req.method === "GET") return html(continuePage(url.searchParams.get("t") || ""));
    if (path === "/admin/auth" && req.method === "POST") {
      const t = (await form(req)).get("t") || "";
      const email = t ? await env.KV.get(`login:${t}`) : null;
      if (!email || !(await roleOf(env, email))) return html(loginPage("That link has expired or was already used. Ask for a new one."), 401);
      await env.KV.delete(`login:${t}`);
      return new Response(null, { status: 303, headers: { location: "/admin", "set-cookie": await makeCookie(env, email), ...SECURITY } });
    }
    if (path === "/admin/logout" && req.method === "POST") {
      return new Response(null, { status: 303, headers: { location: "/admin", "set-cookie": `${COOKIE}=; Path=/admin; HttpOnly; Secure; SameSite=Lax; Max-Age=0`, ...SECURITY } });
    }

    const who = await session(req, env);
    const role = who ? await roleOf(env, who) : null;
    if (path === "/admin") return who ? html(role === "desk" || role === "stage" ? oneViewPage(who, role, env.SITE_URL) : appPage(who, role, env.SITE_URL)) : html(loginPage());
    if (!who) return path.startsWith("/admin/api/") ? json({ error: "Signed out." }, 401) : new Response(null, { status: 303, headers: { location: "/admin" } });

    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      if (req.headers.get("x-admin") !== "1" || (origin && origin !== url.origin)) return json({ error: "Refused." }, 403);
    }
    const refuse = () => json({ error: "Not available to your account." }, 403);
    // Payment proofs, receipts and exports are for admin and the treasurer only.
    const books = role === "admin" || role === "verifier";
    if (path === "/admin/proof") return books ? proof(env, url.searchParams.get("ref")) : refuse();
    if (path === "/admin/receipt") {
      if (!books) return refuse();
      // The treasurer can open receipts; only admin can attach them.
      if (req.method === "POST") {
        if (role !== "admin") return json({ error: "Not available to your account." }, 403);
        return json(await money.putReceipt(env, req, url.searchParams.get("id")));
      }
      return money.getReceipt(env, url.searchParams.get("id"));
    }
    if (path === "/admin/logo" && req.method === "POST") {
      if (role !== "admin") return refuse();
      return json(await logos.putLogo(env, req, url.searchParams.get("key"), who));
    }
    if (path.startsWith("/admin/export/")) {
      const name = path.slice("/admin/export/".length);
      if (role !== "admin" && !(role === "verifier" && (name === "registrations.csv" || name === "money.csv"))) return refuse();
      if (name === "badges.csv") return new Response(await ops.badgesCsv(env), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="qlv2026-badges.csv"', ...SECURITY } });
      return exportCsv(env, name);
    }

    const q = url.searchParams;
    if (path === "/admin/print/sheets") return role === "admin" ? html(await sheetsPage(env, q.get("t") || "all")) : refuse();
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : null;
    const api = {
      "GET list": () => list(env, q.get("status") || "awaiting"),
      "GET reg": () => detail(env, q.get("ref")),
      "GET preview": () => preview(env, q.get("ref")),
      "GET answers": () => answerList(env),
      "GET reminders": () => reminderStatus(env),
      "GET reminder-preview": () => reminderPreview(env),
      "POST reminders": () => sendReminders(env),
      "GET codes": () => codesStatus(env),
      "GET codes-preview": () => codesPreview(env),
      "POST codes": () => sendCodes(env),
      "GET members": () => membersList(env),
      "POST member-fix": () => memberFix(env, body, who),
      "POST member-preview": () => memberPreview(env, body),
      "POST verify": () => verify(env, body.ref, who),
      "POST unverify": () => unverify(env, body.ref, who, role),
      "POST send": () => send(env, body.ref),
      "POST query-preview": () => queryPreview(env, body),
      "POST query": () => query(env, body),
      "POST release": () => release(env, body.ref),
      "POST reopen": () => reopen(env, body.ref),
      "POST resend-ticket": () => resendTicket(env, body),
      "POST closing": () => setClosing(env, body),
      "GET tables": () => ops.tablesView(env),
      "POST lock": () => ops.lockExport(env, who),
      "GET partners": () => ops.partnersList(env),
      "GET partner": () => ops.partnerDetail(env, q.get("id")),
      "POST partner": () => ops.createPartner(env, body, who),
      "POST partner-confirm": () => ops.confirmPartner(env, body, who),
      "POST partner-resend": () => ops.resendPartnerSeats(env, body),
      "POST partner-void": () => ops.voidPartnerSeat(env, body),
      "GET staff": () => ops.staffList(env),
      "POST facilitator": () => ops.createFacilitator(env, body, who),
      "GET export": () => ops.exportRows(env),
      "POST badge-name": () => ops.setBadgeName(env, body),
      "GET money": () => money.moneyView(env),
      "GET screen": () => logos.screenList(env),
      "GET board-access": () => boardView(env),
      "GET lobby": () => lobby.lobbyAdmin(env),
      "POST lobby-open": () => lobby.openLobby(env, who),
      "POST lobby-rooms": () => lobby.openRooms(env, who),
      "POST lobby-settings": () => lobby.lobbySettings(env, body, who),
      "POST lobby-post": () => lobby.savePost(env, body, who),
      "POST lobby-post-action": () => lobby.postAction(env, body, who),
      "POST lobby-hide": () => lobby.hideMessage(env, body, who),
      "POST lobby-person": () => lobby.personAction(env, body, who),
      "POST board-access": () => boardAction(env, body, who),
      "POST screen-member": () => logos.addMemberBusiness(env, body, who),
      "POST screen-save": () => logos.saveScreenEntry(env, body, who),
      "POST screen-member-remove": () => logos.removeMemberBusiness(env, body),
      "POST screen-logo-remove": () => logos.removeLogo(env, body, who),
      "POST money-entry": () => money.saveEntry(env, body, who),
      "POST money-delete": () => money.deleteEntry(env, body, who),
      "POST cancel-ticket": async () => detail(env, (await ops.cancelTicket(env, body)).reg_ref),
      "POST replace-ticket": async () => { const x = await ops.replaceTicket(env, body); return { ...(await detail(env, x.reg_ref)), sent: x.sent }; },
      ...part2Routes(env, q, body, who, [...emails(env.ADMIN_EMAILS), ...emails(env.VERIFIER_EMAILS)]),
    }[`${req.method} ${path.slice("/admin/api/".length)}`];
    if (!path.startsWith("/admin/api/") || !api) return json({ error: "Not found." }, 404);
    if (role !== "admin" && !CAN[role]?.has(`${req.method} ${path.slice("/admin/api/".length)}`)) return refuse();
    return json(role === "board" ? redact(await api()) : await api());
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(err);
    return json({ error: "Something went wrong. Try again in a minute." }, 500);
  }
}
