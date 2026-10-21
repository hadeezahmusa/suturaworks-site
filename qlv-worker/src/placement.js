// The table placement rule, in one place. Pure functions only: no database,
// no clock, no randomness, so the same registrations in the same order always
// give the same tables. seating.js applies it to the database.
//
// For each person, in the order they are seated:
//  1. take every table with fewer than CAPACITY people;
//  2. if there are none, open the next table;
//  3. if they have an organisation key, prefer tables with nobody from that
//     organisation; if every open table has someone, take the tables with the
//     fewest from it;
//  4. of those, take the table with the fewest people, then the fewest JCI Aso
//     members, then the lowest number;
//  5. sit them in the lowest free seat number at that table.

import { ORG_IGNORE, ORG_SUFFIXES, TABLE_CAPACITY, INITIAL_TABLES } from "./config.js";

const IGNORE = new Set(ORG_IGNORE);
const SUFFIXES = new Set(ORG_SUFFIXES);

// "Zenith Bank Plc." -> "zenith bank". Blank or ignorable answers -> null.
export function orgKey(raw) {
  if (!raw) return null;
  const words = String(raw).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1])) words.pop();
  const key = words.join(" ");
  if (!key || IGNORE.has(key)) return null;
  return key;
}

// tables: array indexed by table number, each { seats: [{ seat, org, member }] }.
// person: { org: key or null, member: true for a JCI Aso member }.
// Returns { table, seat } and never changes its input.
export function choose(tables, person, { capacity = TABLE_CAPACITY, initial = INITIAL_TABLES } = {}) {
  const count = Math.max(initial, tables.length);
  const all = Array.from({ length: count }, (_, i) => tables[i] || { seats: [] });
  let open = all.map((t, i) => ({ t, i })).filter(({ t }) => t.seats.length < capacity);
  if (!open.length) open = [{ t: { seats: [] }, i: count }];

  if (person.org) {
    const same = ({ t }) => t.seats.filter((s) => s.org === person.org).length;
    const fewest = Math.min(...open.map(same));
    open = open.filter((o) => same(o) === fewest);
  }

  const members = ({ t }) => t.seats.filter((s) => s.member).length;
  open.sort((a, b) => a.t.seats.length - b.t.seats.length || members(a) - members(b) || a.i - b.i);
  const pick = open[0];
  const taken = new Set(pick.t.seats.map((s) => s.seat));
  let seat = 1;
  while (taken.has(seat)) seat++;
  return { table: pick.i, seat };
}

// Builds the tables structure from seated rows ({ table_index, table_seat,
// org_key, kind }).
export function tablesFrom(rows) {
  const tables = [];
  for (const r of rows) {
    if (r.table_index === null || r.table_index === undefined) continue;
    (tables[r.table_index] ||= { seats: [] }).seats.push({ seat: r.table_seat, org: r.org_key || null, member: r.kind === "member" });
  }
  for (let i = 0; i < tables.length; i++) tables[i] ||= { seats: [] };
  return tables;
}
