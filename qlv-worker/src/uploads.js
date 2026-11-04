// Bulk upload for sponsored bookings, admin only (QLV-2026-Sponsored-Seats-
// Bulk-Upload-Build-Spec.md, narrowed by the Chair so the registration page
// is not touched). The sponsor fills the template and sends it in; admin
// uploads it on the booking. Each valid row becomes a Sponsored seat ticket,
// sent at once, exactly as if the person had used the share link. The share
// link keeps working for the seats still free, and no mix of the two can go
// over the seats booked.
//
// The template and the reading of the file happen in the admin's browser
// (ExcelJS); the rows come here as plain fields and are checked again here.

import { HttpError, now, token, nextRef, ticketLinks, sendMail, links, closesAt } from "./index.js";
import { SITUATIONS } from "../../qlv2026/questions.js";
import { closeLabel } from "../../qlv2026/event.js";
import { seatPending } from "./seating.js";
import { sendBatch, dailyRoom } from "./mailer.js";
import * as lobby from "./lobby.js";
import * as mail from "./emails.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max = 160) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const COLUMNS = ["Seat", "First name *", "Last name *", "Email *", "Phone *", "Organisation", "Which is closest to you? *"];
const SIT = Object.fromEntries(SITUATIONS.flatMap((s) => [[s.label.toLowerCase(), s.value], [s.short.toLowerCase(), s.value], [s.value, s.value]]));

async function booking(env, ref) {
  const r = await env.DB.prepare("SELECT * FROM registrations WHERE ref = ? AND tier = 'sponsored'").bind(String(ref || "")).first();
  if (!r) throw new HttpError(404, "That is not a sponsored booking.");
  return r;
}

export async function seatsView(env, ref) {
  const r = await booking(env, ref);
  const [{ results: held }, { results: log }] = await Promise.all([
    env.DB.prepare("SELECT id, name, email, ticket_ref, via, sent_at, cancelled_at FROM tickets WHERE reg_ref = ? AND kind = 'sponsored' ORDER BY id").bind(r.ref).all(),
    env.DB.prepare("SELECT * FROM seat_uploads WHERE reg_ref = ? ORDER BY id DESC").bind(r.ref).all(),
  ]);
  return {
    ref: r.ref, org: r.name, contact: r.contact_person, email: r.email, seats: r.size, status: r.status,
    paid: r.status === "verified" || r.status === "confirmed", used: held.length, free: Math.max(0, r.size - held.length),
    holders: held.map((t) => ({ name: t.name, email: t.email, ref: t.ticket_ref, via: t.via === "upload" ? "Upload" : "Share link", cancelled: !!t.cancelled_at })),
    uploads: log, columns: COLUMNS, situations: SITUATIONS.map((s) => s.label),
  };
}

// Checks every row; nothing is saved. The same checks run again on import.
async function check(env, r, rows) {
  if (!Array.isArray(rows)) throw new HttpError(400, "The file had no rows.");
  const filled = rows.filter((x) => x && Object.values(x).some((v) => clean(v)));
  const { n: used } = await env.DB.prepare("SELECT COUNT(*) AS n FROM tickets WHERE reg_ref = ? AND kind = 'sponsored'").bind(r.ref).first();
  const free = Math.max(0, r.size - used);
  const seen = new Map();
  const out = [];
  for (const [i, x] of filled.entries()) {
    const row = {
      line: Number(x.line) || i + 1,
      first: clean(x.first, 60), last: clean(x.last, 60), email: clean(x.email).toLowerCase(), phone: clean(x.phone, 30),
      organisation: clean(x.organisation) || r.name, situationText: clean(x.situation, 80),
    };
    // Optional: a template sent out without this column, or a blank cell, counts as working for an organisation.
    row.situation = row.situationText ? SIT[row.situationText.toLowerCase()] || null : "emp";
    const errors = [];
    if (!row.first) errors.push("First name is empty");
    if (!row.last) errors.push("Last name is empty");
    if (!row.email) errors.push("Email is empty");
    else if (!EMAIL_RE.test(row.email)) errors.push("Email is not valid");
    if (!row.phone) errors.push("Phone is empty");
    else if (!/^[+0-9 ()-]{7,20}$/.test(row.phone) || row.phone.replace(/\D/g, "").length < 7) errors.push("Phone needs at least seven digits");
    if (!row.situation) errors.push("Which is closest to you? is not one of the choices");
    if (row.email && seen.has(row.email)) errors.push(`Same email as line ${seen.get(row.email)}`);
    if (row.email && !seen.has(row.email)) seen.set(row.email, row.line);
    row.errors = errors;
    out.push(row);
  }
  // An email that already has a ticket is skipped, not an error.
  const emails = out.filter((x) => !x.errors.length).map((x) => x.email);
  const taken = emails.length ? new Set((await env.DB.prepare("SELECT lower(email) AS e FROM tickets WHERE cancelled_at IS NULL AND lower(email) IN (SELECT value FROM json_each(?))").bind(JSON.stringify(emails)).all()).results.map((t) => t.e)) : new Set();
  for (const x of out) x.status = x.errors.length ? "error" : taken.has(x.email) ? "registered" : "ok";
  const ok = out.filter((x) => x.status === "ok").length;
  const blocked = ok > free ? `This file has ${ok} people to add but only ${free} ${free === 1 ? "seat is" : "seats are"} free.` : null;
  return { rows: out, ok, errors: out.filter((x) => x.status === "error").length, registered: out.filter((x) => x.status === "registered").length, free, blocked };
}

export async function previewUpload(env, b) {
  const r = await booking(env, b.ref);
  if (b.fileRef && b.fileRef !== r.ref) throw new HttpError(409, `This file is for booking ${b.fileRef}, not ${r.ref}.`);
  return { ...(await check(env, r, b.rows)), ...(await seatsView(env, r.ref)) };
}

// Registers the valid rows. Payment must be verified first, so tickets can
// go out straight away.
export async function importUpload(env, b, who) {
  const r = await booking(env, b.ref);
  if (b.fileRef && b.fileRef !== r.ref) throw new HttpError(409, `This file is for booking ${b.fileRef}, not ${r.ref}.`);
  if (!(r.status === "verified" || r.status === "confirmed")) throw new HttpError(409, "Verify this booking's payment first. Tickets from an upload go out straight away.");
  const c = await check(env, r, b.rows);
  if (c.blocked) throw new HttpError(409, c.blocked);
  const add = c.rows.filter((x) => x.status === "ok");
  if (!add.length) throw new HttpError(409, "There is nobody new to register in this file.");
  const { room } = await dailyRoom(env);
  if (add.length + (b.notify ? 1 : 0) > room) throw new HttpError(409, `${add.length} tickets need ${add.length} emails, and only ${room} can go today on the free plan.`);
  const stamp = now();
  const made = [];
  for (const x of add) {
    const t = { token: token(24), reg_ref: r.ref, kind: "sponsored", name: `${x.first} ${x.last}`, email: x.email, phone: x.phone, situation: x.situation, organisation: x.organisation };
    // The seat cap is in the insert itself, so the share link and an upload
    // running at the same moment can never pass the seats booked.
    const ins = await env.DB.prepare(`INSERT INTO tickets (token, reg_ref, ticket_ref, kind, name, email, phone, situation, organisation, via, created_at)
        SELECT ?, ?, 'pending', 'sponsored', ?, ?, ?, ?, ?, 'upload', ?
        WHERE (SELECT COUNT(*) FROM tickets WHERE reg_ref = ? AND kind = 'sponsored') < ?
        RETURNING id`).bind(t.token, r.ref, t.name, t.email, t.phone, t.situation, t.organisation, stamp, r.ref, r.size).first();
    if (!ins) break;
    const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM tickets WHERE reg_ref = ? AND kind = 'sponsored' AND id <= ?").bind(r.ref, ins.id).first();
    t.id = ins.id;
    t.ticket_ref = await nextRef(env, "sponsored");
    await env.DB.prepare("UPDATE tickets SET ticket_ref = ?, seat_no = ?, sent_at = ? WHERE id = ?").bind(t.ticket_ref, n, stamp, ins.id).run();
    made.push(t);
  }
  await seatPending(env);
  // Each person gets the normal ticket email, with their lobby link once the lobby is open.
  const msgs = [];
  for (const t of made) {
    const lobbyLink = await lobby.lobbyLinkForTicket(env, { id: t.id, kind: "sponsored" });
    msgs.push({ ref: t.ticket_ref, to: t.email, ...mail.ticketIssued(t, r, { ...ticketLinks(env, t), lobby: lobbyLink }) });
  }
  for (let i = 0; i < msgs.length; i += 90) await sendBatch(env, msgs.slice(i, i + 90), "ticket_issued");
  const skipped = c.registered + (add.length - made.length);
  await env.DB.prepare("INSERT INTO seat_uploads (reg_ref, file_name, uploaded_by, uploaded_at, imported, skipped, failed) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(r.ref, clean(b.fileName, 120) || "upload", who, stamp, made.length, skipped, c.errors).run();
  let sponsorEmailed = false;
  if (b.notify && r.email && made.length) {
    const v = await seatsView(env, r.ref);
    sponsorEmailed = await sendMail(env, { to: r.email, ...mail.uploadSummary({ first: (r.contact_person || r.name || "").split(" ")[0], n: made.length, used: v.used, seats: r.size, manage: r.manage_token ? links(env, r).manage : null, close: closeLabel(await closesAt(env)) }) }, r.ref, "upload_summary");
  }
  return { imported: made.length, skipped, failed: c.errors, sponsorEmailed, ...(await seatsView(env, r.ref)) };
}
