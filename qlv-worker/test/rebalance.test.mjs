// Run with: node --test qlv-worker/test
import test from "node:test";
import assert from "node:assert/strict";
import { planSpread, planEven, shortTables, after, tablesInUse, signature } from "../src/rebalance-plan.js";

// Six full tables and a seventh that opened late with two people.
function sample() {
  const rows = [];
  let id = 1;
  for (let t = 0; t < 6; t++) for (let s = 1; s <= 8; s++) rows.push({ id: id, name: `P${id}`, kind: s === 1 ? "member" : "standard", table_index: t, table_seat: s, org_key: `org${id}`, seated_at: `2026-10-${String(10 + (id % 20)).padStart(2, "0")}T00:00:${String(id % 60).padStart(2, "0")}Z` }), id++;
  rows.push({ id: id++, name: "Late A", kind: "standard", table_index: 6, table_seat: 1, org_key: "acme", seated_at: "2026-10-29T00:00:00Z" });
  rows.push({ id: id++, name: "Late B", kind: "standard", table_index: 6, table_seat: 2, org_key: null, seated_at: "2026-10-29T00:00:01Z" });
  return rows;
}

test("the late seventh table is the one flagged", () => {
  assert.deepEqual(shortTables(sample(), 5), [6]);
  assert.deepEqual(shortTables(sample(), 2), []);
});

test("spread closes the short table: two tables of 9, as in the mockup", () => {
  const rows = sample();
  const moves = planSpread(rows, 6);
  assert.equal(moves.length, 2);
  const c = after(rows, moves);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((t) => c[t]).sort(), [8, 8, 8, 8, 9, 9]);
  assert.equal(c[6], 0);
  assert.notEqual(moves[0].to, moves[1].to, "the two go to different tables");
  assert.ok(moves.every((m) => m.seat === 9), "they take seat 9");
});

test("spread keeps people away from their organisation when it can", () => {
  const rows = sample();
  rows.find((r) => r.table_index === 0 && r.table_seat === 2).org_key = "acme";
  const moves = planSpread(rows, 6);
  assert.notEqual(moves.find((m) => m.name === "Late A").to, 0);
});

test("share out evenly stops as soon as every table is within one of the others", () => {
  const rows = sample();
  const moves = planEven(rows, 6);
  // 2 + 5 = 7, and the six givers are left at 7, 7, 7, 7, 7 and 8.
  assert.equal(moves.length, 5);
  assert.deepEqual(new Set(moves.map((m) => m.from)).size, 5, "never two from one table");
  const c = after(rows, moves);
  const vals = tablesInUse(rows).map((t) => c[t]);
  assert.ok(Math.max(...vals) - Math.min(...vals) <= 1);
  const seats = moves.map((m) => m.seat).sort((a, b) => a - b);
  assert.deepEqual(seats, [3, 4, 5, 6, 7]);
});

test("share out evenly takes the most recently seated person who passes the organisation rule", () => {
  const rows = sample();
  const t0 = rows.filter((r) => r.table_index === 0);
  const latest = [...t0].sort((a, b) => b.seated_at.localeCompare(a.seated_at))[0];
  latest.org_key = "acme";
  const moves = planEven(rows, 6);
  const fromT0 = moves.find((m) => m.from === 0);
  assert.notEqual(fromT0.id, latest.id, "the Acme person is skipped because Acme is already at the short table");
});

test("the signature changes when counts change", () => {
  const rows = sample();
  const s1 = signature(rows);
  rows.pop();
  assert.notEqual(signature(rows), s1);
});
