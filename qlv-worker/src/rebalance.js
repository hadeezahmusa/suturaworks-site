// Rebalance at lock (part 2, feature 1). Between registration closing and the
// team announcement, admin can fix a table that is too small. Nothing moves
// until Apply, and Apply re-checks that the preview still matches. After the
// announcement the page is read only and nobody already seated ever moves.

import { HttpError, now, closesAt } from "./index.js";
import { tableName } from "./config.js";
import { getSettings, saveSettings, isFrozen } from "./settings.js";
import { seatPending } from "./seating.js";
import { planSpread, planEven, shortTables, tablesInUse, counts, after, signature } from "./rebalance-plan.js";
import { autoAssign } from "./briefings.js";

export async function seatedRows(env) {
  return (await env.DB.prepare(`SELECT id, name, kind, table_index, table_seat, org_key, seated_at FROM tickets
    WHERE table_index IS NOT NULL AND cancelled_at IS NULL ORDER BY table_index, table_seat`).all()).results;
}

function plan(rows, option, short) {
  return option === "even" ? planEven(rows, short) : planSpread(rows, short);
}

// What the Tables page and the Rebalance page need to know.
export async function rebalanceState(env) {
  await seatPending(env);
  const [s, rows, close] = await Promise.all([getSettings(env), seatedRows(env), closesAt(env)]);
  const frozen = isFrozen(s);
  const closed = Date.now() >= Date.parse(close);
  const short = shortTables(rows, s.min_table_size);
  const sig = signature(rows);
  return { s, rows, frozen, closed, short, sig, flag: closed && !frozen && short.length > 0 && s.rebalance_dismissed !== sig };
}

export async function rebalanceView(env) {
  const st = await rebalanceState(env);
  const { s, rows, short } = st;
  const c = counts(rows);
  const target = short[0];
  const options = {};
  if (target !== undefined) {
    for (const option of ["spread", "even"]) {
      const moves = plan(rows, option, target);
      const a = after(rows, moves);
      options[option] = {
        moves: moves.map((m) => ({ ...m, fromName: tableName(m.from), toName: tableName(m.to) })),
        rows: tablesInUse(rows).map((t) => ({ name: tableName(t), before: c[t], after: a[t] || 0 })),
        tablesAfter: tablesInUse(rows).filter((t) => a[t] > 0).length,
        biggest: Math.max(...Object.values(a)),
      };
    }
  }
  return {
    min: s.min_table_size, seated: rows.length, frozen: st.frozen, closed: st.closed, dismissed: s.rebalance_dismissed === st.sig,
    teamsAnnouncedAt: s.teams_announced_at,
    short: short.map((t) => ({ index: t, name: tableName(t), count: c[t] })),
    target: target === undefined ? null : { index: target, name: tableName(target), count: c[target] },
    options,
    history: (await env.DB.prepare("SELECT option, moves, applied_at, applied_by FROM rebalances ORDER BY id DESC LIMIT 5").all()).results
      .map((h) => ({ ...h, moves: JSON.parse(h.moves).length })),
  };
}

// Applies the plan the admin saw. If anyone was seated or moved since the
// preview, the moves differ and nothing changes.
export async function applyRebalance(env, b, who) {
  const st = await rebalanceState(env);
  if (st.frozen) throw new HttpError(409, "Teams have been announced, so nobody can be moved now.");
  if (!st.short.includes(Number(b.table))) throw new HttpError(409, "That table is no longer below the minimum. Refresh the page.");
  const moves = plan(st.rows, b.option === "even" ? "even" : "spread", Number(b.table));
  const key = (ms) => ms.map((m) => `${m.id}>${m.to}:${m.seat}`).join(",");
  if (!moves.length) throw new HttpError(409, "There is nothing to move.");
  if (key(moves) !== String(b.expect || "")) throw new HttpError(409, "The tables changed since you opened this page. Check the new moves and apply again.");
  const stamp = now();
  // One batch: every move or none. Each update checks the person is still where the preview saw them.
  const res = await env.DB.batch([
    ...moves.map((m) => env.DB.prepare("UPDATE tickets SET table_index = ?, table_seat = ? WHERE id = ? AND table_index = ? AND cancelled_at IS NULL")
      .bind(m.to, m.seat, m.id, m.from)),
    env.DB.prepare("INSERT INTO rebalances (option, moves, applied_at, applied_by) VALUES (?, ?, ?, ?)")
      .bind(b.option === "even" ? "even" : "spread", JSON.stringify(moves.map((m) => ({ id: m.id, name: m.name, from: tableName(m.from), to: tableName(m.to) }))), stamp, who),
    // Everything generated from the tables is now out of date.
    env.DB.prepare("UPDATE packs SET stale = 1"),
  ]);
  const moved = res.slice(0, moves.length).reduce((n, r) => n + (r.meta.changes || 0), 0);
  if (moved !== moves.length) console.error("rebalance: expected", moves.length, "moved", moved);
  // Mentor routes and facilitator tables follow the new tables.
  await autoAssign(env);
  return { applied: moves.length, ...(await rebalanceView(env)) };
}

export async function dismissRebalance(env, who) {
  const st = await rebalanceState(env);
  await saveSettings(env, { rebalance_dismissed: st.sig }, who);
  return rebalanceView(env);
}

export async function announceTeams(env, who) {
  await saveSettings(env, { teams_frozen: true }, who);
  return rebalanceView(env);
}
