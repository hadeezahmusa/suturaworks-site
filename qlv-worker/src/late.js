// Late additions and name stickers (QLV-2026-Name-Stickers-Build-Spec.md).
//
// After "Lock and stamp" on the badge export, anyone who becomes due for a
// seat is flagged as a late addition instead of being seated (seating.js).
// Admin, or the desk login, seats each one by hand at a table, with the
// table that has the fewest people and nobody from the same organisation
// suggested first. A late addition can be moved until they are checked in;
// nobody seated before the lock is ever moved from here.
//
// Stickers are for sprinters only, from the latest locked snapshot: the
// people seated by the time of the lock. The PDFs are drawn in the browser
// (qlv2026/stickers.js).

import { HttpError, now, sendMail } from "./index.js";
import { tableName } from "./config.js";
import { DUE_SQL, orgFor, chooseFrozen, seatPending } from "./seating.js";
import * as lobby from "./lobby.js";
import * as mail from "./emails.js";

const SPRINTERS = "('standard', 'member', 'corporate', 'sponsored', 'partner')";
const LAYOUT_KEY = "sticker:layout";
export const LAYOUT_DEFAULT = { left: 4.65, top: 13.1, colPitch: 101.6, rowPitch: 67.7, cols: 2, rows: 4 };

async function lastLock(env) {
  return env.DB.prepare("SELECT created_at, created_by FROM export_snapshots WHERE locked = 1 ORDER BY id DESC LIMIT 1").first();
}

// Tables in use with their counts, in naming order.
async function tablesWithCounts(env) {
  const { results } = await env.DB.prepare(`SELECT table_index AS t, COUNT(*) AS n FROM tickets WHERE table_index IS NOT NULL AND cancelled_at IS NULL GROUP BY table_index ORDER BY table_index`).all();
  return results.map((r) => ({ index: r.t, no: r.t + 1, name: tableName(r.t), count: r.n }));
}

export async function lateView(env) {
  await seatPending(env);   // flags anyone newly due
  const [lock, tables, { results: seated }, { results: due }, { results: late }] = await Promise.all([
    lastLock(env), tablesWithCounts(env),
    env.DB.prepare("SELECT id, kind, table_index, table_seat, org_key FROM tickets WHERE table_index IS NOT NULL AND cancelled_at IS NULL").all(),
    env.DB.prepare(DUE_SQL).all(),
    env.DB.prepare(`SELECT t.id, t.name, t.badge_name, t.ticket_ref, t.kind, t.organisation, t.table_index, t.late_added_at, t.seated_at, t.seated_by, t.seated_by_user,
        c.arrived_at FROM tickets t LEFT JOIN checkins c ON c.ticket_id = t.id
      WHERE t.late_addition = 1 AND t.cancelled_at IS NULL ORDER BY t.table_index IS NOT NULL, t.late_added_at, t.id`).all(),
  ]);
  const dueById = Object.fromEntries(due.map((d) => [d.id, d]));
  const people = late.map((p) => {
    const d = dueById[p.id] || { ...p };
    const org = orgFor(d);
    const sug = tables.length ? chooseFrozen(seated.filter((r) => r.id !== p.id), { org, member: p.kind === "member" }) : null;
    return {
      id: p.id, name: p.badge_name || p.name, ref: p.ticket_ref, organisation: p.organisation || "", addedAt: p.late_added_at,
      table: p.table_index === null ? null : { index: p.table_index, no: p.table_index + 1, name: tableName(p.table_index) },
      seatedAt: p.table_index === null ? null : p.seated_at, seatedBy: p.seated_by, checkedIn: !!p.arrived_at,
      suggested: sug ? sug.table : null,
    };
  });
  return { locked: !!lock, lockedAt: lock ? lock.created_at : null, tables, people };
}

// Seats (or moves) one late addition. Admin or the desk.
export async function seatLate(env, b, who, role) {
  const id = Number(b.id), table = Number(b.table);
  const t = await env.DB.prepare(`SELECT t.*, c.arrived_at FROM tickets t LEFT JOIN checkins c ON c.ticket_id = t.id WHERE t.id = ? AND t.cancelled_at IS NULL`).bind(id).first();
  if (!t) throw new HttpError(404, "That ticket was not found.");
  if (t.late_addition !== 1) throw new HttpError(409, `${t.name} was seated before the lock, so they can't be moved from here.`);
  if (t.table_index !== null && t.arrived_at) throw new HttpError(409, `${t.name} is already checked in at ${tableName(t.table_index)}, so they stay there.`);
  const tables = await tablesWithCounts(env);
  if (!tables.some((x) => x.index === table)) throw new HttpError(400, "Choose one of the tables in use.");
  if (t.table_index === table) return lateView(env);
  const due = (await env.DB.prepare(DUE_SQL.replace("WHERE t.table_index IS NULL AND", "WHERE t.id = ? AND")).bind(id).all()).results[0] || t;
  const org = orgFor(due);
  for (let attempt = 0; attempt < 4; attempt++) {
    const top = await env.DB.prepare("SELECT COALESCE(MAX(table_seat), 0) AS s FROM tickets WHERE table_index = ?").bind(table).first();
    try {
      await env.DB.prepare(`UPDATE tickets SET table_index = ?, table_seat = ?, org_key = ?, seated_at = ?, late_after_freeze = NULL, seated_by = ?, seated_by_user = ? WHERE id = ?`)
        .bind(table, top.s + 1, org, now(), role === "desk" ? "desk" : "admin", who, id).run();
      break;
    } catch (err) { if (!/UNIQUE|constraint/i.test(String(err)) || attempt === 3) throw err; }
  }
  if (b.notify && t.email) {
    const link = await lobby.lobbyLinkForTicket(env, { id, kind: t.kind }, false);
    await sendMail(env, { to: t.email, ...mail.lateSeated({ first: (t.badge_name || t.name).split(" ")[0], table: tableName(table), no: table + 1, link }) }, t.ticket_ref, "late_seated");
  }
  return lateView(env);
}

// ---------- stickers ----------

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

export async function stickersView(env) {
  const lock = await lastLock(env);
  const layout = { ...LAYOUT_DEFAULT, ...((await env.KV.get(LAYOUT_KEY, "json")) || {}) };
  if (!lock) return { locked: false, layout };
  const { results } = await env.DB.prepare(`SELECT id, name, badge_name, ticket_ref, table_index FROM tickets
    WHERE kind IN ${SPRINTERS} AND cancelled_at IS NULL AND ticket_ref != 'pending' AND table_index IS NOT NULL
      AND COALESCE(late_addition, 0) = 0 AND seated_at <= ?`).bind(lock.created_at).all();
  const rows = results.map((t) => ({ id: t.id, name: (t.badge_name || t.name || "").replace(/\s+/g, " ").trim(), tableNo: t.table_index + 1, table: tableName(t.table_index), ticket: t.ticket_ref }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const signature = await sha(JSON.stringify(rows.map((r) => [r.id, r.name, r.tableNo, r.ticket])));
  const { results: dl } = await env.DB.prepare("SELECT kind, signature, MAX(downloaded_at) AS at FROM print_downloads WHERE kind LIKE 'stickers_%' GROUP BY kind").all();
  const downloads = Object.fromEntries(dl.map((d) => [d.kind, { at: d.at, changed: d.signature !== signature }]));
  const { n: late } = await env.DB.prepare(`SELECT COUNT(*) AS n FROM tickets WHERE late_addition = 1 AND cancelled_at IS NULL`).first();
  return { locked: true, lockedAt: lock.created_at, lockedBy: lock.created_by, rows, signature, downloads, late, layout };
}

export async function stickerDownloaded(env, b, who) {
  const kind = ["stickers_a4", "stickers_single", "stickers_blank", "sticker_one"].includes(b.kind) ? b.kind : null;
  if (!kind) throw new HttpError(400, "Unknown download.");
  await env.DB.prepare("INSERT INTO print_downloads (kind, target, signature, downloaded_at, downloaded_by) VALUES (?, ?, ?, ?, ?)")
    .bind(kind, String(b.target || "all").slice(0, 40), String(b.signature || "").slice(0, 40), now(), who).run();
  return stickersView(env);
}

export async function saveStickerLayout(env, b) {
  if (b.reset) { await env.KV.delete(LAYOUT_KEY); return stickersView(env); }
  const out = {};
  for (const [k, lo, hi] of [["left", 0, 40], ["top", 0, 60], ["colPitch", 50, 210], ["rowPitch", 30, 297], ["cols", 1, 3], ["rows", 1, 8]]) {
    const v = Number(b[k]);
    if (!(v >= lo && v <= hi)) throw new HttpError(400, `Check the ${k.replace(/([A-Z])/g, " $1").toLowerCase()}.`);
    out[k] = k === "cols" || k === "rows" ? Math.round(v) : Math.round(v * 100) / 100;
  }
  await env.KV.put(LAYOUT_KEY, JSON.stringify(out));
  return stickersView(env);
}

// One person's sticker, for a reprint or a late addition who has a table.
export async function stickerFor(env, id) {
  const t = await env.DB.prepare(`SELECT name, badge_name, ticket_ref, table_index, kind FROM tickets WHERE id = ? AND cancelled_at IS NULL`).bind(Number(id)).first();
  if (!t) throw new HttpError(404, "That ticket was not found.");
  if (!["standard", "member", "corporate", "sponsored", "partner"].includes(t.kind)) throw new HttpError(409, "Stickers are for sprinters only. Staff wear badges.");
  if (t.table_index === null) throw new HttpError(409, "Seat them at a table first.");
  return { name: (t.badge_name || t.name).replace(/\s+/g, " ").trim(), tableNo: t.table_index + 1, table: tableName(t.table_index), ticket: t.ticket_ref };
}
