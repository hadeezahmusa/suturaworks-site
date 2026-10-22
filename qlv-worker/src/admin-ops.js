// Server side of the Tables, Partners, Staff and Export pages. Admin only:
// nothing here reaches a participant page, email or ticket. Participants never
// see their table.

import { TABLE_CAPACITY, INITIAL_TABLES, PARTNER_LEVELS, RING_COLOURS, CLASH_COLOUR, tableName } from "./config.js";
import { choose, tablesFrom } from "./placement.js";
import { seatPending, freeSeat } from "./seating.js";
import * as mail from "./emails.js";
import { HttpError, now, token, nextRef, ticketLinks, sendMail } from "./index.js";
import { ngn } from "../../qlv2026/event.js";

const LETTER = { member: "J", standard: "S", corporate: "C", sponsored: "P", partner: "T" };
const TIER = { member: "JCI Aso member", standard: "Standard", corporate: "Corporate", sponsored: "Sponsored", partner: "Partner" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max = 160) => String(v ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
const title = (k) => (k || "").replace(/\b[a-z]/g, (c) => c.toUpperCase());

async function lastLock(env) {
  return env.DB.prepare("SELECT created_at, created_by FROM export_snapshots WHERE locked = 1 ORDER BY id DESC LIMIT 1").first();
}

// ---------- Tables ----------

// Seats paid for but not yet claimed: confirmed sponsors, Standard groups
// with a link to share, and partners. Groups count with sponsored seats.
async function heldSeats(env) {
  const r = await env.DB.prepare(`SELECT
      (SELECT COALESCE(SUM(r.size), 0) - (SELECT COUNT(*) FROM tickets t JOIN registrations r2 ON r2.ref = t.reg_ref
         WHERE r2.status = 'confirmed' AND r2.attendees IS NULL AND r2.size > 1 AND t.kind = r2.tier AND r2.tier IN ('sponsored', 'standard')
           AND t.ticket_ref != 'pending' AND t.cancelled_at IS NULL)
       FROM registrations r WHERE r.tier IN ('sponsored', 'standard') AND r.attendees IS NULL AND r.size > 1 AND r.status = 'confirmed') AS sponsored,
      (SELECT COUNT(*) FROM partner_seats s JOIN partners p ON p.id = s.partner_id
       WHERE p.status = 'confirmed' AND s.ticket_id IS NULL AND s.voided_at IS NULL) AS partner`).first();
  return { sponsored: Math.max(0, r.sponsored || 0), partner: r.partner || 0 };
}

export async function tablesView(env) {
  await seatPending(env);
  const rows = (await env.DB.prepare(`SELECT id, kind, table_index, table_seat, org_key, seated_at FROM tickets
    WHERE table_index IS NOT NULL ORDER BY seated_at, id`).all()).results;
  const tables = tablesFrom(rows);
  const count = Math.max(INITIAL_TABLES, tables.length);
  // Ring colours for organisations with two or more people, in order of first seat.
  const orgSize = {};
  for (const r of rows) if (r.org_key) orgSize[r.org_key] = (orgSize[r.org_key] || 0) + 1;
  const ring = {};
  let next = 0;
  for (const r of rows) if (r.org_key && orgSize[r.org_key] > 1 && !ring[r.org_key]) ring[r.org_key] = RING_COLOURS[next++ % RING_COLOURS.length];
  const probe = choose(tables, { org: "\u0000new", member: false });
  const flags = [];
  const out = [];
  for (let i = 0; i < count; i++) {
    const here = rows.filter((r) => r.table_index === i);
    const perOrg = {};
    for (const r of here) if (r.org_key) perOrg[r.org_key] = (perOrg[r.org_key] || 0) + 1;
    for (const [k, n] of Object.entries(perOrg)) if (n > 1) flags.push({ kind: "clash", title: `Two from ${title(k)} share ${tableName(i)}`, text: "Every table with space already had someone from that organisation, so the rule allowed a pair." });
    const seats = [];
    const most = Math.max(TABLE_CAPACITY, ...here.map((x) => x.table_seat));
    for (let k = 1; k <= most; k++) {
      const r = here.find((x) => x.table_seat === k);
      seats.push(r ? { n: k, letter: LETTER[r.kind] || "?", tier: TIER[r.kind] || r.kind, ring: r.org_key ? (perOrg[r.org_key] > 1 ? CLASH_COLOUR : ring[r.org_key] || null) : null } : { n: k });
    }
    const tierCount = (kind) => here.filter((r) => r.kind === kind).length;
    out.push({
      index: i, name: tableName(i), count: here.length, seats, added: i >= INITIAL_TABLES,
      next: i === probe.table && here.length < TABLE_CAPACITY,
      mix: `JCI Aso ${tierCount("member")} · Standard ${tierCount("standard")} · Corporate ${tierCount("corporate")} · Sponsored ${tierCount("sponsored")} · Partner ${tierCount("partner")}`,
    });
  }
  if (count > INITIAL_TABLES) {
    const extra = count - INITIAL_TABLES;
    flags.push({ kind: "extra", title: extra === 1 ? "A seventh table was opened" : `${extra} extra tables were opened`, text: "Each table works one task and passes its plan on, so a task needs to be ready for it and the handover chain gets one more step." });
  }
  const feed = rows.slice(-6).reverse().map((r) => ({ letter: LETTER[r.kind], text: `${TIER[r.kind]} seated at ${tableName(r.table_index)}, seat ${r.table_seat}` }));
  const lock = await lastLock(env);
  return {
    tables: out, flags, feed,
    totals: { seated: rows.length, tables: out.filter((t) => t.count).length, members: rows.filter((r) => r.kind === "member").length, next: tableName(probe.table) },
    held: await heldSeats(env),
    lock,
  };
}

export async function lockExport(env, who) {
  await env.DB.prepare("INSERT INTO export_snapshots (created_at, created_by, locked) VALUES (?, ?, 1)").bind(now(), who).run();
  return { lock: await lastLock(env) };
}

// ---------- Partners ----------

export async function partnersList(env) {
  const { results } = await env.DB.prepare(`SELECT p.*,
      (SELECT COUNT(*) FROM partner_seats s JOIN tickets t ON t.id = s.ticket_id WHERE s.partner_id = p.id AND t.cancelled_at IS NULL) AS claimed
    FROM partners p ORDER BY p.created_at DESC`).all();
  const confirmed = results.filter((p) => p.status === "confirmed").reduce((n, p) => n + p.amount, 0);
  return {
    partners: results.map((p) => ({ ...p, levelName: PARTNER_LEVELS[p.level]?.name || p.level, amountText: ngn(p.amount) })),
    levels: Object.entries(PARTNER_LEVELS).map(([id, l]) => ({ id, ...l, amountText: ngn(l.amount) })),
    income: { confirmed, confirmedText: ngn(confirmed) },
  };
}

async function partnerRow(env, id) {
  const p = await env.DB.prepare("SELECT * FROM partners WHERE id = ?").bind(Number(id)).first();
  if (!p) throw new HttpError(404, "No such partner.");
  return p;
}
const seatUrl = (env, s) => `${env.SITE_URL}?seat=${s.token}`;

export async function partnerDetail(env, id) {
  const p = await partnerRow(env, id);
  const { results } = await env.DB.prepare(`SELECT s.*, t.name, t.ticket_ref, t.table_index, t.table_seat, t.cancelled_at
    FROM partner_seats s LEFT JOIN tickets t ON t.id = s.ticket_id WHERE s.partner_id = ? ORDER BY s.seat_no`).bind(p.id).all();
  return {
    partner: { ...p, levelName: PARTNER_LEVELS[p.level]?.name || p.level, amountText: ngn(p.amount) },
    seats: results.map((s) => ({
      id: s.id, seat_no: s.seat_no, sent_at: s.sent_at,
      state: s.ticket_id ? (s.cancelled_at ? "cancelled" : "claimed") : "waiting",
      name: s.name, ref: s.ticket_ref, table: s.table_index === null || s.table_index === undefined ? null : `${tableName(s.table_index)}, seat ${s.table_seat}`,
      url: s.ticket_id ? null : seatUrl(env, s),
    })),
  };
}

export async function createPartner(env, b, who) {
  const level = PARTNER_LEVELS[b.level];
  if (!level) throw new HttpError(400, "Pick a level.");
  const name = clean(b.name);
  const contact = clean(b.contactName, 120);
  const email = clean(b.contactEmail).toLowerCase();
  if (!name) throw new HttpError(400, "Enter the partner organisation.");
  if (!contact) throw new HttpError(400, "Enter the contact person.");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "The contact email does not look complete.");
  const stamp = now();
  const p = await env.DB.prepare(`INSERT INTO partners (name, level, amount, seats_total, status, contact_name, contact_email, created_at, created_by)
    VALUES (?, ?, ?, ?, 'awaiting_payment', ?, ?, ?, ?) RETURNING id`).bind(name, b.level, level.amount, level.seats, contact, email, stamp, who).first();
  // Partner tickets hang from a registrations row of their own. Its amount is
  // zero: partner income is recorded on the partner, never as ticket income.
  const ref = "PTN-" + String(p.id).padStart(3, "0");
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO registrations (ref, secret, tier, size, amount, status, name, email, organisation, contact_person, created_at, updated_at)
      VALUES (?, ?, 'partner', ?, 0, 'awaiting', ?, ?, ?, ?, ?, ?)`).bind(ref, token(24), level.seats, name, email, name, contact, stamp, stamp),
    env.DB.prepare("UPDATE partners SET reg_ref = ? WHERE id = ?").bind(ref, p.id),
  ]);
  return partnerDetail(env, p.id);
}

async function emailSeats(env, p, seats, kind) {
  const ok = await sendMail(env, { to: p.contact_email, ...mail.partnerLinks(p, seats.map((s) => ({ seat_no: s.seat_no, url: seatUrl(env, s) }))) }, p.reg_ref, kind);
  if (!ok) throw new HttpError(502, "The email did not send. Try again in a minute.");
  await env.DB.prepare(`UPDATE partner_seats SET sent_at = ? WHERE id IN (SELECT value FROM json_each(?))`).bind(now(), JSON.stringify(seats.map((s) => s.id))).run();
}

// Payment checked outside the system: make one claim link per seat and email
// them all to the contact in one message.
export async function confirmPartner(env, b, who) {
  const p = await partnerRow(env, b.id);
  if (p.status === "confirmed") throw new HttpError(409, "This partner is already confirmed.");
  const note = clean(b.note, 300);
  const stamp = now();
  const stmts = [
    env.DB.prepare("UPDATE partners SET status = 'confirmed', confirmed_at = ?, payment_note = ? WHERE id = ?").bind(stamp, note || null, p.id),
    env.DB.prepare("UPDATE registrations SET status = 'confirmed', verified_at = ?, verified_by = ?, sent_at = ?, updated_at = ? WHERE ref = ?").bind(stamp, who, stamp, stamp, p.reg_ref),
  ];
  for (let i = 1; i <= p.seats_total; i++) {
    stmts.push(env.DB.prepare("INSERT INTO partner_seats (partner_id, seat_no, token, created_at) VALUES (?, ?, ?, ?)").bind(p.id, i, token(12), stamp));
  }
  await env.DB.batch(stmts);
  const seats = (await env.DB.prepare("SELECT * FROM partner_seats WHERE partner_id = ? ORDER BY seat_no").bind(p.id).all()).results;
  await emailSeats(env, { ...p, status: "confirmed" }, seats, "partner_links");
  return partnerDetail(env, p.id);
}

export async function resendPartnerSeats(env, b) {
  const p = await partnerRow(env, b.id);
  const where = b.seatId ? "AND id = ?" : "";
  const q = env.DB.prepare(`SELECT * FROM partner_seats WHERE partner_id = ? AND ticket_id IS NULL AND voided_at IS NULL ${where} ORDER BY seat_no`);
  const seats = (await (b.seatId ? q.bind(p.id, Number(b.seatId)) : q.bind(p.id)).all()).results;
  if (!seats.length) throw new HttpError(409, "Every seat has been claimed, so there is nothing to send.");
  await emailSeats(env, p, seats, "partner_links");
  return partnerDetail(env, p.id);
}

// Kills a link that went astray and puts a fresh one on the same seat.
export async function voidPartnerSeat(env, b) {
  const s = await env.DB.prepare("SELECT * FROM partner_seats WHERE id = ?").bind(Number(b.seatId)).first();
  if (!s) throw new HttpError(404, "No such seat.");
  if (s.ticket_id) throw new HttpError(409, "This seat has been claimed, so its link no longer works anyway.");
  await env.DB.prepare("UPDATE partner_seats SET token = ?, sent_at = NULL WHERE id = ? AND ticket_id IS NULL").bind(token(12), s.id).run();
  return partnerDetail(env, s.partner_id);
}

// ---------- Staff ----------

const ROLE = (t) => t.kind === "facilitator" ? "Facilitator" : t.kind === "judge" ? "Judge or mentor"
  : t.mode === "judge" ? "Judge" : t.mode === "adviser" ? "Adviser" : "Adviser and judge";
const SOURCE = { facilitator: "Added by admin", adviser: "Sign-up page", judge: "Corporate booking" };

export async function staffList(env) {
  const { results } = await env.DB.prepare(`SELECT t.id, t.kind, t.name, t.badge_name, t.ticket_ref, t.email, t.days, t.sent_at, t.cancelled_at, t.created_at,
      r.mode, r.organisation, r.status FROM tickets t JOIN registrations r ON r.ref = t.reg_ref
    WHERE t.kind IN ('facilitator', 'adviser', 'judge') AND t.cancelled_at IS NULL ORDER BY t.kind = 'facilitator' DESC, t.created_at`).all();
  return { staff: results.map((t) => ({ name: t.name, role: ROLE(t), source: SOURCE[t.kind], status: t.sent_at ? "Registered" : "Ticket not sent yet", ref: t.ticket_ref })) };
}

export async function createFacilitator(env, b, who) {
  const name = clean(b.name, 120);
  const badge = clean(b.badgeName, 60);
  const email = clean(b.email).toLowerCase();
  const days = ["both", "sat", "fri"].includes(b.days) ? b.days : "both";
  if (!name) throw new HttpError(400, "Enter their full name.");
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "The email does not look complete.");
  const ref = await nextRef(env, "facilitator");
  const stamp = now();
  const t = { token: token(24), reg_ref: ref, ticket_ref: ref, kind: "facilitator", name, email, days, badge_name: badge && badge !== name ? badge : null };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO registrations (ref, secret, tier, size, amount, status, name, email, created_at, updated_at, verified_at, verified_by, sent_at)
      VALUES (?, ?, 'facilitator', 1, 0, 'confirmed', ?, ?, ?, ?, ?, ?, ?)`).bind(ref, token(24), name, email, stamp, stamp, stamp, who, stamp),
    env.DB.prepare(`INSERT INTO tickets (token, reg_ref, ticket_ref, kind, name, email, badge_name, days, created_at, sent_at)
      VALUES (?, ?, ?, 'facilitator', ?, ?, ?, ?, ?, ?)`).bind(t.token, ref, ref, name, email, t.badge_name, days, stamp, stamp),
  ]);
  const ok = await sendMail(env, { to: email, ...mail.ticketIssued(t, {}, ticketLinks(env, t)) }, ref, "ticket_issued");
  return { ref, emailed: ok, ...(await staffList(env)) };
}

// ---------- Export ----------

const TYPE = { standard: "Standard", member: "JCI Aso member", corporate: "Corporate", sponsored: "Sponsored", partner: "Partner", facilitator: "Facilitator" };
const DAYS = { both: "Both", sat: "Saturday", fri: "Friday" };

export async function exportRows(env) {
  await seatPending(env);
  const lock = await lastLock(env);
  const { results } = await env.DB.prepare(`SELECT t.id, t.kind, t.name, t.badge_name, t.ticket_ref, t.table_index, t.table_seat, t.seated_at, t.created_at,
      t.organisation, t.days, r.organisation AS reg_org, r.mode, p.name AS partner_name
    FROM tickets t JOIN registrations r ON r.ref = t.reg_ref LEFT JOIN partners p ON p.id = t.partner_id
    WHERE t.cancelled_at IS NULL AND t.ticket_ref != 'pending'
      AND (t.table_index IS NOT NULL OR (t.kind IN ('facilitator', 'adviser', 'judge') AND t.sent_at IS NOT NULL))`).all();
  const staff = (t) => ["facilitator", "adviser", "judge"].includes(t.kind);
  const rows = results.map((t) => {
    const role = staff(t) ? ROLE(t) : null;
    const org = t.kind === "partner" ? t.partner_name : t.kind === "sponsored" ? t.organisation : t.kind === "facilitator" ? "" : (t.organisation || t.reg_org || "");
    const when = staff(t) ? t.created_at : t.seated_at;
    return {
      id: t.id, name: t.name, badge: t.badge_name || t.name, staff: !!role,
      table: role || tableName(t.table_index), seat: role ? "" : String(t.table_seat),
      ref: t.ticket_ref, type: TYPE[t.kind] || (t.kind === "judge" ? "Judge" : t.mode === "judge" ? "Judge" : "Adviser"),
      org: org || "", days: t.kind === "adviser" ? "Saturday" : DAYS[t.days] || "Both",
      late: !!(lock && when > lock.created_at), sortT: role ? 999 : t.table_index, sortS: role ? 0 : t.table_seat,
    };
  });
  rows.sort((a, b) => a.late - b.late || a.sortT - b.sortT || a.sortS - b.sortS || a.name.localeCompare(b.name));
  const count = (f) => rows.filter(f).length;
  return {
    rows, lock,
    strip: {
      participants: count((r) => !r.staff), facilitators: count((r) => r.type === "Facilitator"),
      advisers: count((r) => r.staff && r.type === "Adviser"), judges: count((r) => r.staff && r.type === "Judge"),
      late: count((r) => r.late),
    },
    held: await heldSeats(env),
  };
}

export async function setBadgeName(env, b) {
  const t = await env.DB.prepare("SELECT id, name FROM tickets WHERE id = ?").bind(Number(b.id)).first();
  if (!t) throw new HttpError(404, "No such person.");
  const badge = clean(b.badge, 60);
  await env.DB.prepare("UPDATE tickets SET badge_name = ? WHERE id = ?").bind(badge && badge !== t.name ? badge : null, t.id).run();
  return { id: t.id, badge: badge || t.name };
}

function cell(v) {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export async function badgesCsv(env) {
  const { rows } = await exportRows(env);
  const head = ["Name", "Badge name", "Table", "Seat", "Ticket", "Type", "Organisation", "Days", "Late addition"];
  const lines = rows.map((r) => [r.name, r.badge, r.table, r.seat, r.ref, r.type, r.org, r.days, r.late ? "yes" : ""].map(cell).join(","));
  return "﻿" + [head.join(","), ...lines].join("\r\n") + "\r\n";
}

// ---------- Cancelling a ticket ----------

export async function cancelTicket(env, b) {
  const t = await env.DB.prepare("SELECT id, reg_ref, cancelled_at FROM tickets WHERE id = ?").bind(Number(b.id)).first();
  if (!t) throw new HttpError(404, "No such ticket.");
  if (t.cancelled_at) throw new HttpError(409, "This ticket is already cancelled.");
  await freeSeat(env, t.id);
  return { reg_ref: t.reg_ref };
}
