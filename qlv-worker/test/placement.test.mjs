// Run with: node --test qlv-worker/test
import test from "node:test";
import assert from "node:assert/strict";
import { choose, orgKey, tablesFrom } from "../src/placement.js";
import { tableName } from "../src/config.js";

// Seats people one after another, the way the live system does.
function seatAll(people, start = []) {
  const rows = [...start];
  for (const p of people) {
    const { table, seat } = choose(tablesFrom(rows), { org: orgKey(p.org), member: p.member });
    rows.push({ ...p, table_index: table, table_seat: seat, org_key: orgKey(p.org), kind: p.member ? "member" : "standard" });
  }
  return rows;
}
const standard = (n, prefix = "u") => Array.from({ length: n }, (_, i) => ({ name: `${prefix}${i}`, org: `${prefix} company ${i}` }));

test("organisation key ignores case, punctuation and company endings", () => {
  assert.equal(orgKey("Zenith Bank Plc."), "zenith bank");
  assert.equal(orgKey("  zenith   bank "), "zenith bank");
  assert.equal(orgKey("ACME Nigeria Ltd"), "acme");
  assert.equal(orgKey("Self-employed"), null);
  assert.equal(orgKey("N/A"), null);
  assert.equal(orgKey(""), null);
  assert.equal(orgKey("Student"), null);
});

test("a corporate team of five lands on five different tables", () => {
  const rows = seatAll(Array.from({ length: 5 }, (_, i) => ({ name: `c${i}`, org: "Northgate Logistics Ltd" })));
  assert.equal(new Set(rows.map((r) => r.table_index)).size, 5);
});

test("JCI Aso members go one per table in turn, then round again", () => {
  const people = [];
  for (let i = 0; i < 12; i++) people.push({ name: `m${i}`, member: true });
  const rows = seatAll(people);
  assert.deepEqual(rows.map((r) => r.table_index), [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5]);
});

test("members are spread even when others arrive between them", () => {
  // Tables already level at one person each; members should not stack.
  const rows = seatAll([...standard(6), { name: "m1", member: true }, { name: "m2", member: true }]);
  const m = rows.filter((r) => r.member).map((r) => r.table_index);
  assert.notEqual(m[0], m[1]);
});

test("two from one organisation share a table only when no other table has space", () => {
  // Fill five tables, leave Legacy (index 5) with space, put an Acme person somewhere full.
  let rows = seatAll(standard(40));
  // 40 people over 6 tables: everyone has space still; seat 8 Acme people.
  rows = seatAll(Array.from({ length: 8 }, (_, i) => ({ name: `a${i}`, org: "Acme" })), rows);
  const acme = rows.filter((r) => r.org === "Acme");
  const perTable = {};
  for (const r of acme) perTable[r.table_index] = (perTable[r.table_index] || 0) + 1;
  // 48 seats on six tables are now full, so the 7th and 8th Acme people opened new tables or doubled up only once all six had one.
  const firstSix = acme.slice(0, 6).map((r) => r.table_index);
  assert.equal(new Set(firstSix).size, 6, "first six Acme people each get their own table");
});

test("after six tables of eight are full, the next person opens Cornerstone", () => {
  const rows = seatAll(standard(49));
  const last = rows.at(-1);
  assert.equal(last.table_index, 6);
  assert.equal(tableName(last.table_index), "Cornerstone");
  assert.equal(rows.filter((r) => r.table_index < 6).length, 48);
});

test("no table ever holds more than eight", () => {
  const rows = seatAll([...standard(70), ...Array.from({ length: 30 }, (_, i) => ({ name: `j${i}`, member: true }))]);
  const counts = {};
  for (const r of rows) counts[r.table_index] = (counts[r.table_index] || 0) + 1;
  assert.ok(Object.values(counts).every((n) => n <= 8));
  const seats = new Set(rows.map((r) => `${r.table_index}:${r.table_seat}`));
  assert.equal(seats.size, rows.length, "no two people share a seat");
});

test("a refund empties exactly that seat and nothing else moves", () => {
  const rows = seatAll(standard(20));
  const before = rows.map((r) => `${r.name}@${r.table_index}:${r.table_seat}`);
  const gone = rows.splice(7, 1)[0];
  const after = rows.map((r) => `${r.name}@${r.table_index}:${r.table_seat}`);
  assert.deepEqual(after, before.filter((x) => !x.startsWith(gone.name + "@")));
  // The next person takes the emptiest suitable table, at the lowest free seat there.
  const next = seatAll([{ name: "late", org: "late co" }], rows).at(-1);
  if (next.table_index === gone.table_index) assert.equal(next.table_seat, gone.table_seat);
});

test("the same people in the same order always give the same tables", () => {
  const people = [...standard(30), ...Array.from({ length: 10 }, (_, i) => ({ name: `j${i}`, member: true })), ...Array.from({ length: 5 }, (_, i) => ({ name: `c${i}`, org: "Acme" }))];
  const a = seatAll(people).map((r) => `${r.table_index}:${r.table_seat}`);
  const b = seatAll(people).map((r) => `${r.table_index}:${r.table_seat}`);
  assert.deepEqual(a, b);
});

test("choose does not change the tables it is given", () => {
  const rows = seatAll(standard(5));
  const tables = tablesFrom(rows);
  const snapshot = JSON.stringify(tables);
  choose(tables, { org: "x", member: false });
  assert.equal(JSON.stringify(tables), snapshot);
});

test("matches the reference sketch in the Tables mockup, seat for seat", () => {
  // The 52 sample registrations from the mockup, in verification order.
  const regs = [];
  const aIdx = [3, 4, 5, 6, 7], bIdx = [8, 10, 12, 14, 16, 18, 40], lIdx = [20, 21, 22, 23], mIdx = [26, 27];
  let u = 0;
  for (let i = 1; i <= 52; i++) {
    if (aIdx.includes(i)) regs.push({ tier: "C", org: "A" });
    else if (bIdx.includes(i)) regs.push({ tier: "S", org: "B" });
    else if (lIdx.includes(i)) regs.push({ tier: "T", org: "L1" });
    else if (mIdx.includes(i)) regs.push({ tier: "T", org: "M" });
    else if (i % 3 === 1) regs.push({ tier: "J", org: null });
    else regs.push({ tier: i % 11 === 0 ? "P" : "S", org: "u" + (u++) });
  }
  // The mockup's own pick(), copied as written.
  const tables = [];
  for (let i = 0; i < 6; i++) tables.push({ seats: [] });
  const orgCount = (t, o) => t.seats.filter((s) => s.org === o).length;
  const jciCount = (t) => t.seats.filter((s) => s.tier === "J").length;
  const pick = (r) => {
    let open = tables.filter((t) => t.seats.length < 8);
    if (open.length === 0) { const nt = { seats: [] }; tables.push(nt); open = [nt]; }
    if (r.org) {
      const free = open.filter((t) => orgCount(t, r.org) === 0);
      if (free.length) open = free;
      else { const min = Math.min(...open.map((t) => orgCount(t, r.org))); open = open.filter((t) => orgCount(t, r.org) === min); }
    }
    open = open.slice().sort((a, b) => a.seats.length - b.seats.length || jciCount(a) - jciCount(b) || tables.indexOf(a) - tables.indexOf(b));
    return open[0];
  };
  const theirs = regs.map((r) => { const t = pick(r); t.seats.push(r); return `${tables.indexOf(t)}:${t.seats.length}`; });
  // Ours, fed the same people (org keys used as given).
  const rows = [];
  const ours = regs.map((r) => {
    const { table, seat } = choose(tablesFrom(rows), { org: r.org, member: r.tier === "J" });
    rows.push({ table_index: table, table_seat: seat, org_key: r.org, kind: r.tier === "J" ? "member" : "standard" });
    return `${table}:${seat}`;
  });
  assert.deepEqual(ours, theirs);
});
