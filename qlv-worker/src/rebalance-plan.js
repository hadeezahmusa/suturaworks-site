// Rebalancing tables between the lock and the team announcement. Pure
// functions: given who sits where, return the moves. rebalance.js previews
// and applies them. Nobody moves until admin presses Apply.
//
// rows: [{ id, name, kind, table_index, table_seat, org_key, seated_at }]

// Tables with at least one person, in table order. Closed tables drop out.
export function tablesInUse(rows) {
  return [...new Set(rows.map((r) => r.table_index))].sort((a, b) => a - b);
}

export function counts(rows) {
  const c = {};
  for (const r of rows) c[r.table_index] = (c[r.table_index] || 0) + 1;
  return c;
}

// Tables below the minimum, smallest first.
export function shortTables(rows, min) {
  const c = counts(rows);
  return tablesInUse(rows).filter((t) => c[t] < min).sort((a, b) => c[a] - c[b] || a - b);
}

// A short label of the current counts, so a dismissed flag returns if they change.
export function signature(rows) {
  const c = counts(rows);
  return tablesInUse(rows).map((t) => `${t}:${c[t]}`).join(",");
}

function freeSeat(taken, table) {
  const used = taken[table] ||= new Set();
  let s = 1;
  while (used.has(s)) s++;
  used.add(s);
  return s;
}

function seatsTaken(rows) {
  const taken = {};
  for (const r of rows) (taken[r.table_index] ||= new Set()).add(r.table_seat);
  return taken;
}

// Spread them: close the short table and move each person to the emptiest
// other table with nobody from their organisation. If none qualifies, use the
// part 1 fallback: the tables with the fewest from that organisation. Ties go
// to the table with the fewest JCI Aso members, then the lowest number.
// Tables may go above 8.
export function planSpread(rows, short) {
  const others = tablesInUse(rows).filter((t) => t !== short);
  if (!others.length) return [];
  const c = counts(rows);
  const orgs = {}, members = {};
  for (const r of rows) {
    if (r.org_key) (orgs[r.table_index] ||= []).push(r.org_key);
    if (r.kind === "member") members[r.table_index] = (members[r.table_index] || 0) + 1;
  }
  const taken = seatsTaken(rows);
  const moving = rows.filter((r) => r.table_index === short).sort((a, b) => a.table_seat - b.table_seat);
  return moving.map((p) => {
    let pool = others;
    if (p.org_key) {
      const same = (t) => (orgs[t] || []).filter((o) => o === p.org_key).length;
      const fewest = Math.min(...pool.map(same));
      pool = pool.filter((t) => same(t) === fewest);
    }
    const to = [...pool].sort((a, b) => c[a] - c[b] || (members[a] || 0) - (members[b] || 0) || a - b)[0];
    c[to]++;
    if (p.org_key) (orgs[to] ||= []).push(p.org_key);
    if (p.kind === "member") members[to] = (members[to] || 0) + 1;
    return { id: p.id, name: p.name, from: short, to, seat: freeSeat(taken, to) };
  });
}

// Share out evenly: keep the short table and fill it from the fullest tables
// until every table is within one of the others. From each giving table, move
// the most recently seated person whose organisation is not already at the
// short table.
export function planEven(rows, short) {
  const c = counts(rows);
  const tables = tablesInUse(rows);
  const at = rows.map((r) => ({ ...r }));
  const orgsHere = new Set(at.filter((r) => r.table_index === short && r.org_key).map((r) => r.org_key));
  const taken = seatsTaken(rows);
  const stuck = new Set();
  const moves = [];
  for (;;) {
    const givers = tables.filter((t) => t !== short && !stuck.has(t) && c[t] - c[short] > 1)
      .sort((a, b) => c[b] - c[a] || a - b);
    if (!givers.length) break;
    const g = givers[0];
    const pick = at.filter((r) => r.table_index === g && (!r.org_key || !orgsHere.has(r.org_key)))
      .sort((a, b) => (b.seated_at || "").localeCompare(a.seated_at || "") || b.id - a.id)[0];
    if (!pick) { stuck.add(g); continue; }
    pick.table_index = short;
    c[g]--; c[short]++;
    if (pick.org_key) orgsHere.add(pick.org_key);
    moves.push({ id: pick.id, name: pick.name, from: g, to: short, seat: freeSeat(taken, short) });
  }
  return moves;
}

// Counts after a plan, for the before and after table.
export function after(rows, moves) {
  const c = counts(rows);
  for (const m of moves) { c[m.from]--; c[m.to] = (c[m.to] || 0) + 1; }
  return c;
}
