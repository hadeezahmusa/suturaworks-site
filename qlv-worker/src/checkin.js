// Check-in at the badge desk (part 2, feature 2). Optional: when it is off,
// nothing else in the system mentions arrivals. It never moves anyone.
// The desk sees name, reference and table only.

import { HttpError, now } from "./index.js";
import { tableName } from "./config.js";
import { getSettings } from "./settings.js";

const STAFF = { facilitator: "Facilitator", adviser: "Mentor or judge", judge: "Mentor or judge" };

export async function checkinView(env) {
  const s = await getSettings(env);
  if (!s.checkin_enabled) return { enabled: false };
  const { results } = await env.DB.prepare(`SELECT t.id, t.name, t.badge_name, t.ticket_ref, t.kind, t.table_index, c.arrived_at
    FROM tickets t JOIN registrations r ON r.ref = t.reg_ref LEFT JOIN checkins c ON c.ticket_id = t.id
    WHERE t.cancelled_at IS NULL AND t.ticket_ref != 'pending'
      AND (t.table_index IS NOT NULL OR (t.kind IN ('facilitator', 'adviser', 'judge') AND r.status = 'confirmed'))
    ORDER BY t.name COLLATE NOCASE`).all();
  const seated = results.filter((r) => r.table_index !== null);
  const tables = {};
  for (const r of seated) {
    const t = (tables[r.table_index] ||= { name: tableName(r.table_index), count: 0, of: 0 });
    t.of++;
    if (r.arrived_at) t.count++;
  }
  return {
    enabled: true,
    arrived: seated.filter((r) => r.arrived_at).length, seated: seated.length,
    tables: Object.entries(tables).sort((a, b) => a[0] - b[0]).map(([, t]) => t),
    people: results.map((r) => ({
      id: r.id, name: r.badge_name || r.name, ref: r.ticket_ref,
      where: r.table_index !== null ? tableName(r.table_index) : STAFF[r.kind] || "Staff",
      arrived: !!r.arrived_at,
    })),
  };
}

export async function markArrival(env, b, who) {
  const s = await getSettings(env);
  if (!s.checkin_enabled) throw new HttpError(409, "Check-in is switched off.");
  const id = Number(b.id);
  const t = await env.DB.prepare("SELECT id FROM tickets WHERE id = ? AND cancelled_at IS NULL").bind(id).first();
  if (!t) throw new HttpError(404, "That ticket was not found.");
  if (b.arrived) await env.DB.prepare("INSERT OR IGNORE INTO checkins (ticket_id, arrived_at, marked_by) VALUES (?, ?, ?)").bind(id, now(), who).run();
  else await env.DB.prepare("DELETE FROM checkins WHERE ticket_id = ?").bind(id).run();
  return checkinView(env);
}

// "arrived n of 8" under each table on the Tables page, when check-in is on.
export async function arrivalsByTable(env) {
  const s = await getSettings(env);
  if (!s.checkin_enabled) return null;
  const { results } = await env.DB.prepare(`SELECT t.table_index AS t, COUNT(c.ticket_id) AS n FROM tickets t LEFT JOIN checkins c ON c.ticket_id = t.id
    WHERE t.table_index IS NOT NULL AND t.cancelled_at IS NULL GROUP BY t.table_index`).all();
  return Object.fromEntries(results.map((r) => [r.t, r.n]));
}
