// E-certificates and thank-you emails (QLV-2026-E-Certificates-Build-Spec.md,
// narrowed by the Chair): certificates only for the sprinters checked in on
// Saturday, Achievement for the top three tables instead of Participation.
// Judges, mentors/advisers, the Lead Sprint Marshal and the desk volunteers
// get a thank-you email. Facilitators get nothing from here: JCI Aso writes
// to them. Nothing is sent until admin presses a button.
//
// The PDF is drawn in the admin's browser (qlv2026/certificate.js, with the
// fonts on the site), because a Worker on the free plan has only a few
// milliseconds of CPU per request. The Worker checks, keeps the PDF in KV
// and emails it.

import { HttpError, now, token, sendMail } from "./index.js";
import { tableName } from "./config.js";
import { getSettings } from "./settings.js";
import { dailyRoom } from "./mailer.js";
import { staffPeople } from "./briefings.js";
import * as mail from "./emails.js";
import { ensureFeedback, feedbackUrl, markEmailed, certificateGate } from "./feedback.js";

const SPRINTERS = ["standard", "member", "corporate", "sponsored", "partner"];
const PLACE = ["First", "Second", "Third"];
const RESULTS_KEY = "cert:results";
const THANKS_KEY = "cert:thanks_message";
// People thanked who are on no other list: [{ email, name, role }], role
// "stage", "desk", "chair" or "president". Set by hand for the stage coordinator and the person
// who ran check-in on the admin login.
const THANKS_EXTRA = "cert:thanks_extra";
const SIG = { president: "cert:sig:president", chair: "cert:sig:chair" };
const certId = (n) => "QLV26-C-" + String(n).padStart(3, "0");
const clean = (v, max = 160) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

export const THANKS_DEFAULT = {
  subject: "Thank you for QLV 2026",
  body: "Dear {first_name},\n\nThank you for giving your time to Quality Leadership Value 2026 as {role}. The sprint worked because people like you showed up for the teams, and they felt it.\n\nWe are grateful, and we hope to work with you again.\n\nWarm regards,\nHadeezah Balarabe Musa\nChairperson, Quality Leadership Value 2026",
};

// Names worth a second look before they go on a certificate.
export function nameFlags(name) {
  const n = String(name || ""), flags = [];
  const letters = n.replace(/[^A-Za-z]/g, "");
  if (letters.length > 3 && letters === letters.toUpperCase()) flags.push("all capitals");
  else if (letters && letters === letters.toLowerCase()) flags.push("all lower case");
  if (n.trim().split(/\s+/).filter(Boolean).length < 2) flags.push("only one name");
  if (/\s{2,}/.test(n) || n !== n.trim()) flags.push("extra spaces");
  if (/[0-9@]/.test(n)) flags.push("numbers or @");
  return flags;
}

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// What the certificate says: the hash of this is how "changed since sent" works.
// The top three teams get two certificates: Achievement, and Participation
// with the same number and "-P" after it.
export function certContent(c) {
  return { name: c.printedName, version: c.version, place: c.place, table: c.tableName, id: c.certId, also: c.version === "achievement" && c.certId ? c.certId + "-P" : null };
}

async function results(env) {
  return (await env.KV.get(RESULTS_KEY, "json")) || null;
}

async function signatures(env) {
  const [p, c] = await Promise.all([env.KV.getWithMetadata(SIG.president), env.KV.getWithMetadata(SIG.chair)]);
  return { president: p.value ? p.metadata : null, chair: c.value ? c.metadata : null };
}

// Every sprinter with a ticket, whether checked in, and their certificate row.
// Checked-in sprinters get a row (and so an ID) the first time this runs.
async function sprinters(env) {
  const q = () => env.DB.prepare(`SELECT t.id, t.name, t.email, t.kind, t.ticket_ref, t.table_index, t.late_after_freeze,
      r.tier, r.status AS reg_status, c.arrived_at, ce.id AS cert, ce.printed_name, ce.token, ce.sent_at, ce.sent_hash, ce.name_edited_at
    FROM tickets t JOIN registrations r ON r.ref = t.reg_ref LEFT JOIN checkins c ON c.ticket_id = t.id LEFT JOIN certificates ce ON ce.ticket_id = t.id
    WHERE t.kind IN ('standard', 'member', 'corporate', 'sponsored', 'partner') AND t.cancelled_at IS NULL
      AND t.ticket_ref != 'pending' AND t.sent_at IS NOT NULL
    ORDER BY t.table_index IS NULL, t.table_index, t.name COLLATE NOCASE`).all();
  let { results: rows } = await q();
  const missing = rows.filter((r) => r.arrived_at && !r.cert);
  if (missing.length) {
    const stamp = now();
    await env.DB.batch(missing.map((r) => env.DB.prepare("INSERT OR IGNORE INTO certificates (ticket_id, printed_name, token, created_at) VALUES (?, ?, ?, ?)").bind(r.id, clean(r.name, 120), token(24), stamp)));
    rows = (await q()).results;
  }
  return rows;
}

function versionOf(r, res) {
  const place = res && r.table_index !== null && r.table_index !== undefined ? res.top.indexOf(r.table_index) : -1;
  // Only the winning team gets Achievement (as well as Participation).
  // Second and third get Participation, like everyone else.
  return place === 0 ? { version: "achievement", place: 1 } : { version: "participation", place: null };
}

async function certRows(env) {
  const [rows, res] = await Promise.all([sprinters(env), results(env)]);
  const out = [];
  for (const r of rows) {
    const v = versionOf(r, res);
    const c = {
      ticketId: r.id, ref: r.ticket_ref, name: r.name, email: r.email, checkedIn: !!r.arrived_at,
      tableName: r.table_index === null || r.table_index === undefined ? null : tableName(r.table_index),
      // A sponsor's seats wait for the sponsor's payment (MIVA, for one).
      held: r.tier === "sponsored" && !["verified", "confirmed"].includes(r.reg_status),
      certId: r.cert ? certId(r.cert) : null,
      partId: r.cert && v.version === "achievement" ? certId(r.cert) + "-P" : null, n: r.cert || null, printedName: r.printed_name || r.name,
      version: v.version, place: v.place, sentAt: r.sent_at || null, nameEdited: !!r.name_edited_at,
    };
    c.hash = await sha(JSON.stringify(certContent(c)));
    c.changed = !!(r.sent_at && r.sent_hash && r.sent_hash !== c.hash);
    c.flags = c.checkedIn ? nameFlags(c.printedName) : [];
    out.push(c);
  }
  return out;
}

// The top three as the scoring stands, and what admin confirmed.
async function proposed(env) {
  const { computeTally } = await import("./scoring.js");
  const t = await computeTally(env);
  return {
    order: t.order.slice(0, 3).map((r) => ({ index: r.index, name: r.name, avg: r.avgText, outlives: r.outlivesText, tied: r.tied })),
    tieAtThree: t.order.length > 3 && t.order[3].tied,
    allComplete: t.allComplete,
    tables: t.rows.map((r) => ({ index: r.index, name: r.name })),
  };
}

export async function certView(env) {
  const s = await getSettings(env);
  if (!s.checkin_enabled) return { enabled: false };
  const [rows, res, sigs, prop] = await Promise.all([certRows(env), results(env), signatures(env), proposed(env)]);
  return {
    enabled: true, rows, signatures: sigs, results: res ? { ...res, names: res.top.map(tableName) } : null, proposed: prop,
    thanks: await thanksView(env),
  };
}

export async function confirmResults(env, b, who) {
  if (b.clear) { await env.KV.delete(RESULTS_KEY); return certView(env); }
  const prop = await proposed(env);
  const valid = new Set(prop.tables.map((t) => t.index));
  const top = (Array.isArray(b.top) ? b.top : []).map(Number);
  if (top.length !== 3 || new Set(top).size !== 3 || !top.every((t) => valid.has(t))) throw new HttpError(400, "Choose three different tables for first, second and third.");
  // Certificates already sent with a place would change: say so on the page.
  await env.KV.put(RESULTS_KEY, JSON.stringify({ top, confirmedAt: now(), by: who, followsScores: JSON.stringify(top) === JSON.stringify(prop.order.map((o) => o.index)) }));
  return certView(env);
}

export async function setPrintedName(env, b, who) {
  const name = clean(b.name, 120);
  if (name.split(" ").filter(Boolean).length < 1) throw new HttpError(400, "Type the name as it should read.");
  const r = await env.DB.prepare("UPDATE certificates SET printed_name = ?, name_edited_at = ?, name_edited_by = ? WHERE ticket_id = ?").bind(name, now(), who, Number(b.ticketId)).run();
  if (!r.meta.changes) throw new HttpError(404, "That certificate is not there. Refresh the page.");
  return certView(env);
}

// A transparent PNG for each signature, kept in KV.
export async function saveSignature(env, b, who) {
  const key = SIG[b.who];
  if (!key) throw new HttpError(400, "Choose whose signature this is.");
  if (b.remove) { await env.KV.delete(key); return certView(env); }
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
  if (!m) throw new HttpError(400, "Upload the signature as a PNG file.");
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  if (bytes.length > 1500000) throw new HttpError(413, "That image is over 1.5 MB. Save a smaller PNG.");
  if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) throw new HttpError(400, "That file is not a PNG.");
  await env.KV.put(key, bytes, { metadata: { at: now(), by: who, size: bytes.length } });
  return certView(env);
}

export async function signatureImages(env) {
  const [p, c] = await Promise.all([env.KV.get(SIG.president, "arrayBuffer"), env.KV.get(SIG.chair, "arrayBuffer")]);
  // In chunks: spreading a large image into one call overflows the stack.
  const url = (buf) => {
    if (!buf) return null;
    const b = new Uint8Array(buf); let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return "data:image/png;base64," + btoa(s);
  };
  return { president: url(p), chair: url(c) };
}

// One certificate, drawn by the admin's browser, checked and emailed here.
export async function sendCertificate(env, b, who) {
  const s = await getSettings(env);
  if (!s.checkin_enabled) throw new HttpError(409, "Certificates go only to people checked in on the day. Turn on check-in to use this.");
  const sigs = await signatures(env);
  if (!sigs.president || !sigs.chair) throw new HttpError(409, "Upload both signatures first.");
  const rows = await certRows(env);
  const c = rows.find((r) => r.ticketId === Number(b.ticketId));
  if (!c) throw new HttpError(404, "That person is not on the certificate list.");
  if (!c.checkedIn || !c.certId) throw new HttpError(409, `${c.name} was not checked in, so gets no certificate.`);
  if (c.held) throw new HttpError(409, `${c.name}'s certificate waits until their sponsor's payment is confirmed.`);
  // Nothing goes before the top three are confirmed, so nobody in a winning
  // team is sent Participation alone by mistake.
  if (!(await results(env))) throw new HttpError(409, "Confirm the top three first.");
  if (b.hash !== c.hash) throw new HttpError(409, "Something changed on this certificate since the page loaded. Refresh and send again.");
  if (!c.email) throw new HttpError(409, `${c.name} has no email address.`);
  const pdfOf = (b64) => {
    if (!/^[A-Za-z0-9+/=]+$/.test(String(b64 || ""))) throw new HttpError(400, "The certificate did not come through. Try again.");
    const bytes = Uint8Array.from(atob(b64), (x) => x.charCodeAt(0));
    if (bytes.length < 1000 || bytes.length > 4000000 || String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new HttpError(400, "That is not a certificate PDF.");
    return bytes;
  };
  const bytes = pdfOf(b.pdf);
  const part = c.partId ? pdfOf(b.pdf2) : null;
  if (!(await dailyRoom(env)).room) throw new HttpError(409, "The day's email allowance on the free plan is used up. Send the rest tomorrow.");
  await env.KV.put(`cert:pdf:${c.n}`, bytes, { metadata: { hash: c.hash, at: now() } });
  if (part) await env.KV.put(`cert:pdf:${c.n}:p`, part, { metadata: { hash: c.hash, at: now() } });
  // The email carries the feedback link, not the PDF: the certificate
  // downloads once their feedback is in (feedback.js).
  const fb = await ensureFeedback(env, { key: `c:${c.ticketId}`, name: c.name, email: c.email, role: "participant", certTicketId: c.ticketId });
  const msg = mail.certificateEmail({ first: c.printedName.split(" ")[0], link: feedbackUrl(env, fb.token), done: !!fb.submitted_at });
  const ok = await sendMail(env, { to: c.email, ...msg }, c.ref, "certificate");
  if (!ok) throw new HttpError(502, `The email to ${c.name} did not go. Try again in a minute.`);
  await markEmailed(env, `c:${c.ticketId}`);
  await env.DB.prepare("UPDATE certificates SET sent_at = ?, sent_hash = ?, sent_by = ? WHERE ticket_id = ?").bind(now(), c.hash, who, c.ticketId).run();
  return { sent: c.ticketId, certId: c.certId };
}

// The download link in the email: the PDF as it was last sent.
export async function certificateFile(env, url) {
  const t = String(url.searchParams.get("t") || "");
  const row = t.length >= 20 ? await env.DB.prepare("SELECT id, ticket_id FROM certificates WHERE token = ? AND sent_at IS NOT NULL").bind(t).first() : null;
  // Feedback first, then the certificate.
  const gate = row ? await certificateGate(env, row.ticket_id) : null;
  if (gate) return Response.redirect(gate, 302);
  const p = url.searchParams.get("v") === "p";
  const pdf = row ? await env.KV.get(`cert:pdf:${row.id}${p ? ":p" : ""}`, "arrayBuffer") : null;
  if (!pdf) return new Response("This certificate link is not valid.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  return new Response(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="QLV-2026-Certificate-${certId(row.id)}${p ? "-P" : ""}.pdf"`, "cache-control": "private, max-age=300" } });
}

// ---------- thank-you emails ----------

const ROLE_PHRASE = { judge: "a judge", mentor: "a mentor/advisor", both: "a judge and mentor/advisor", marshal: "our Lead Sprint Marshal", desk: "a check-in desk volunteer", stage: "our Stage Coordinator", chair: "our Chairperson", president: "our President" };

export const thanksPeopleFor = (env) => thanksPeople(env);
async function thanksPeople(env) {
  const [staff, checked, team, desk, sent] = await Promise.all([
    staffPeople(env),
    env.DB.prepare("SELECT ticket_id FROM checkins").all().then((r) => new Set(r.results.map((x) => x.ticket_id))),
    env.DB.prepare("SELECT id, name, email FROM lobby_team WHERE marshal = 1 AND removed_at IS NULL").all().then((r) => r.results),
    env.DB.prepare("SELECT email, name FROM access WHERE role = 'desk' ORDER BY email").all().then((r) => r.results),
    env.DB.prepare("SELECT key, sent_at FROM thanks_sent").all().then((r) => Object.fromEntries(r.results.map((x) => [x.key, x.sent_at]))),
  ]);
  const extra = (await env.KV.get(THANKS_EXTRA, "json")) || [];
  const out = [];
  for (const p of staff) {
    if (p.kind === "facilitator" || (!p.judge && !p.mentor)) continue;
    const role = p.judge && p.mentor ? "both" : p.judge ? "judge" : "mentor";
    out.push({ key: `t:${p.id}`, name: p.name, email: p.email, role, roleLabel: { judge: "Judge", mentor: "Mentor/Advisor", both: "Judge and Mentor/Advisor" }[role], eligible: checked.has(p.id), why: checked.has(p.id) ? "" : "Not checked in", sentAt: sent[`t:${p.id}`] || null });
  }
  for (const m of team) out.push({ key: `team:${m.id}`, name: m.name, email: m.email, role: "marshal", roleLabel: "Lead Sprint Marshal", eligible: true, why: "", sentAt: sent[`team:${m.id}`] || null });
  for (const d of desk) out.push({ key: `desk:${d.email}`, name: d.name || "", email: d.email, role: "desk", roleLabel: "Check-in desk", eligible: !!d.name, why: d.name ? "" : "Add their name", sentAt: sent[`desk:${d.email}`] || null, needsName: true });
  const EXTRA_LABEL = { stage: "Stage Coordinator", desk: "Check-in desk", chair: "Chairperson", president: "President" };
  for (const x of extra) {
    const role = EXTRA_LABEL[x.role] ? x.role : "stage";
    const key = `${role}:${String(x.email).toLowerCase()}`;
    if (out.some((p) => p.key === key)) continue;
    out.push({ key, name: x.name, email: x.email, role, roleLabel: EXTRA_LABEL[role], eligible: true, why: "", sentAt: sent[key] || null });
  }
  return out;
}

export async function thanksView(env) {
  return { people: await thanksPeople(env), message: (await env.KV.get(THANKS_KEY, "json")) || THANKS_DEFAULT };
}

export async function saveThanksMessage(env, b) {
  if (b.reset) { await env.KV.delete(THANKS_KEY); return thanksView(env); }
  const subject = clean(b.subject, 150);
  const body = String(b.body || "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, 4000);
  if (!subject || !body) throw new HttpError(400, "The thank-you needs a subject and a message.");
  await env.KV.put(THANKS_KEY, JSON.stringify({ subject, body }));
  return thanksView(env);
}

export async function saveDeskName(env, b) {
  const name = clean(b.name, 120);
  const r = await env.DB.prepare("UPDATE access SET name = ? WHERE email = ? AND role = 'desk'").bind(name || null, String(b.email || "").toLowerCase()).run();
  if (!r.meta.changes) throw new HttpError(404, "That desk volunteer is not there. Refresh the page.");
  return thanksView(env);
}

export function thanksMessage(msg, p) {
  const fill = (t) => t.replace(/\{first_name\}/g, p.name.split(" ")[0] || "there").replace(/\{role\}/g, ROLE_PHRASE[p.role] || "part of the team");
  return { subject: fill(msg.subject), paragraphs: fill(msg.body).split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean) };
}

export async function sendThanks(env, b, who) {
  const { people, message } = await thanksView(env);
  const keys = new Set(Array.isArray(b.keys) ? b.keys : []);
  const pick = people.filter((p) => keys.has(p.key) && p.eligible && p.email);
  if (!pick.length) throw new HttpError(409, "There is nobody to send to.");
  const { room } = await dailyRoom(env);
  if (pick.length > room) throw new HttpError(409, `Only ${room} more emails can go today on the free plan. Send fewer, or the rest tomorrow.`);
  let sent = 0;
  for (const p of pick) {
    const m = thanksMessage(message, p);
    const fb = await ensureFeedback(env, { key: p.key, name: p.name, email: p.email, role: p.role });
    const ok = await sendMail(env, { to: p.email, ...mail.thankYou({ ...m, feedback: fb.submitted_at ? null : feedbackUrl(env, fb.token) }) }, p.key, "thank_you");
    if (ok) {
      sent++;
      if (!fb.submitted_at) await markEmailed(env, p.key);
      await env.DB.prepare("INSERT INTO thanks_sent (key, name, email, sent_at, sent_by) VALUES (?, ?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET sent_at = excluded.sent_at, sent_by = excluded.sent_by, email = excluded.email")
        .bind(p.key, p.name, p.email, now(), who).run();
    }
  }
  return { sent, failed: pick.length - sent, ...(await thanksView(env)) };
}

export async function thanksPreview(env) {
  const { message } = await thanksView(env);
  const m = thanksMessage(message, { name: "Amina Bello", role: "judge" });
  const e = mail.thankYou({ ...m, feedback: `${env.SITE_URL}feedback.html?t=example` });
  return { subject: e.subject, html: e.html };
}

export const _test = { versionOf, nameFlags };
