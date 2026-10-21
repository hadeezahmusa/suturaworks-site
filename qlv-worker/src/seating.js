// Applies the placement rule (placement.js) to the database.
//
// Who gets a table, and when:
//  - standard, member and corporate seats: once the payment is verified;
//  - sponsored and partner seats: once the person has claimed;
//  - judges and mentors, advisers and facilitators: never.
//
// seatPending() seats everyone who is due and not yet seated, in the order
// they became due (verification time, or claim time). It is called after
// every verify and claim, and when the Tables page opens, so existing tickets
// are seated the first time it runs. Seating is idempotent: a seated ticket
// is never touched again. The unique index on (table_index, table_seat) makes
// two simultaneous runs safe: if they collide, one fails and recomputes.

import { choose, tablesFrom, orgKey } from "./placement.js";

const DUE_SQL = `SELECT t.id, t.kind, t.organisation, r.organisation AS reg_org, p.name AS partner_name,
    CASE WHEN t.kind IN ('sponsored', 'partner') THEN t.created_at ELSE r.verified_at END AS due_at
  FROM tickets t JOIN registrations r ON r.ref = t.reg_ref LEFT JOIN partners p ON p.id = t.partner_id
  WHERE t.table_index IS NULL AND t.cancelled_at IS NULL AND t.ticket_ref != 'pending'
    AND ((t.kind IN ('standard', 'member', 'corporate') AND r.status IN ('verified', 'confirmed'))
      OR t.kind IN ('sponsored', 'partner'))
  ORDER BY due_at, t.id`;

const SEATED_SQL = "SELECT id, kind, table_index, table_seat, org_key FROM tickets WHERE table_index IS NOT NULL";

// The organisation that keeps people apart. Members never are; corporate
// seats use the booking, partner seats the partner, everyone else what they typed.
export function orgFor(t) {
  if (t.kind === "member") return null;
  if (t.kind === "corporate") return orgKey(t.reg_org);
  if (t.kind === "partner") return orgKey(t.partner_name);
  return orgKey(t.organisation || (t.kind === "standard" ? t.reg_org : null));
}

export async function seatPending(env) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const [seated, due] = await env.DB.batch([env.DB.prepare(SEATED_SQL), env.DB.prepare(DUE_SQL)]);
    if (!due.results.length) return 0;
    const rows = [...seated.results];
    const stamp = new Date().toISOString();
    const plan = due.results.map((t) => {
      const org = orgFor(t);
      const { table, seat } = choose(tablesFrom(rows), { org, member: t.kind === "member" });
      rows.push({ id: t.id, kind: t.kind, table_index: table, table_seat: seat, org_key: org });
      return { id: t.id, t: table, s: seat, o: org };
    });
    try {
      // One statement for everyone due, so the first run over existing
      // tickets stays inside the per-request query limit.
      const json = JSON.stringify(plan);
      await env.DB.prepare(`UPDATE tickets SET
          table_index = (SELECT json_extract(value, '$.t') FROM json_each(?1) WHERE json_extract(value, '$.id') = tickets.id),
          table_seat = (SELECT json_extract(value, '$.s') FROM json_each(?1) WHERE json_extract(value, '$.id') = tickets.id),
          org_key = (SELECT json_extract(value, '$.o') FROM json_each(?1) WHERE json_extract(value, '$.id') = tickets.id),
          seated_at = ?2
        WHERE table_index IS NULL AND id IN (SELECT json_extract(value, '$.id') FROM json_each(?1))`).bind(json, stamp).run();
      return plan.length;
    } catch (err) {
      // Someone else seated people at the same moment: work it out again.
      if (!/UNIQUE|constraint/i.test(String(err))) throw err;
    }
  }
  throw new Error("Could not seat after several attempts.");
}

// A refund or cancellation: the ticket stops being valid and its seat is
// freed. Nobody else moves; the next person due takes the emptiest table.
export async function freeSeat(env, ticketId) {
  await env.DB.prepare("UPDATE tickets SET cancelled_at = ?, table_index = NULL, table_seat = NULL, seated_at = NULL WHERE id = ? AND cancelled_at IS NULL")
    .bind(new Date().toISOString(), ticketId).run();
}
