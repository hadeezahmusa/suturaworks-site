// The Dashboard tab: every headline number in one place, as small
// aggregates only (no names, no emails), so it loads fast and is safe to
// show on a projector. dashboard-views.js draws it.

import { tableName, PARTNER_LEVELS } from "./config.js";

const SPRINTERS = ["standard", "member", "corporate", "sponsored", "partner"];
const TYPE = { standard: "Standard", member: "Member", corporate: "Corporate", sponsored: "Sponsored", partner: "Sponsor seat" };
const all = (env, sql) => env.DB.prepare(sql).all().then((r) => r.results);
// Abuja is UTC+1 all year.
const lagos = (iso) => new Date(Date.parse(iso) + 3600000).toISOString();

export async function dashboardData(env) {
  const [regs, tickets, checks, emails, partners, rooms, msgs, certs] = await Promise.all([
    all(env, "SELECT tier, size, status, created_at FROM registrations WHERE tier IN ('standard', 'member', 'corporate', 'sponsored') ORDER BY created_at"),
    all(env, "SELECT id, kind, table_index, reg_ref FROM tickets WHERE cancelled_at IS NULL AND ticket_ref != 'pending' AND sent_at IS NOT NULL"),
    all(env, "SELECT ticket_id, arrived_at FROM checkins"),
    all(env, "SELECT kind, ok, created_at FROM email_log"),
    all(env, "SELECT level, amount, status FROM partners"),
    all(env, "SELECT last_opened_at, installed FROM lobby_access WHERE revoked_at IS NULL"),
    all(env, "SELECT COUNT(*) AS n FROM lobby_messages WHERE hidden IS NULL OR hidden = 0"),
    all(env, "SELECT sent_at FROM certificates"),
  ]);
  const { computeTally } = await import("./scoring.js");
  const { moneyView } = await import("./money.js");
  const { feedbackAdmin } = await import("./feedback.js");
  const [tally, mv, fb, results] = await Promise.all([computeTally(env), moneyView(env), feedbackAdmin(env), env.KV.get("cert:results", "json")]);

  const came = new Map(checks.map((c) => [c.ticket_id, c.arrived_at]));
  const spr = tickets.filter((t) => SPRINTERS.includes(t.kind));
  const staff = tickets.filter((t) => !SPRINTERS.includes(t.kind));

  // Registrations: seats booked per day, and the running total.
  const byDay = {};
  for (const r of regs) { const d = lagos(r.created_at).slice(0, 10); byDay[d] = (byDay[d] || 0) + (r.size || 1); }
  let run = 0;
  const regDaily = Object.keys(byDay).sort().map((d) => ({ day: d, n: byDay[d], total: (run += byDay[d]) }));

  // Arrivals on the main day in half-hour slots, Abuja time.
  const days = {};
  for (const t of spr) if (came.get(t.id)) { const d = lagos(came.get(t.id)).slice(0, 10); days[d] = (days[d] || 0) + 1; }
  const mainDay = Object.keys(days).sort((a, b) => days[b] - days[a])[0] || null;
  const slots = {};
  for (const [id, at] of came) {
    if (!mainDay || lagos(at).slice(0, 10) !== mainDay) continue;
    const t = lagos(at), h = t.slice(11, 13), m = Number(t.slice(14, 16)) < 30 ? "00" : "30";
    slots[`${h}:${m}`] = (slots[`${h}:${m}`] || 0) + 1;
  }
  const arrivals = Object.keys(slots).sort().map((s) => ({ slot: s, n: slots[s] }));

  const top = results ? results.top : tally.order.slice(0, 3).map((r) => r.index);
  const teams = tally.rows.map((r) => {
    const ms = spr.filter((t) => t.table_index === r.index);
    return { name: r.name, avg: r.avg, outlives: r.outlives, seated: ms.length, came: ms.filter((t) => came.has(t.id)).length, place: top.indexOf(r.index) + 1 || null };
  }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));

  const kinds = Object.keys(TYPE).map((k) => ({ label: TYPE[k], tickets: spr.filter((t) => t.kind === k).length, came: spr.filter((t) => t.kind === k && came.has(t.id)).length })).filter((x) => x.tickets);

  const emailDay = {}, emailKind = {};
  for (const e of emails) if (e.ok) { const d = lagos(e.created_at).slice(0, 10); emailDay[d] = (emailDay[d] || 0) + 1; emailKind[e.kind] = (emailKind[e.kind] || 0) + 1; }

  const answers = fb.people.filter((p) => p.answers).map((p) => p.answers);
  const dist = (k, lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => answers.filter((a) => a[k] === lo + i).length);

  const sponsorLevels = Object.keys(PARTNER_LEVELS).map((l) => {
    const ps = partners.filter((p) => p.level === l && p.status === "confirmed");
    return { level: PARTNER_LEVELS[l].name, n: ps.length, amount: ps.reduce((s, p) => s + (p.amount || 0), 0) };
  }).filter((x) => x.n);

  const miva = spr.filter((t) => t.reg_ref === "QLV26-017");
  const t = mv.totals;
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      registered: spr.length, attended: spr.filter((x) => came.has(x.id)).length,
      staff: staff.length, staffCame: staff.filter((x) => came.has(x.id)).length,
      certs: certs.length, certsSent: certs.filter((c) => c.sent_at).length,
      feedbackAsked: fb.summary.people, feedbackIn: fb.summary.submitted,
      emails: emails.filter((e) => e.ok).length, teams: teams.length,
    },
    regDaily, arrivals, mainDay, kinds, teams,
    winner: top.length ? tableName(top[0]) : null,
    money: { tickets: t.tickets, sponsors: t.partners, other: t.other, cashIn: t.cashIn, paid: t.paid, owed: t.owed, inKind: t.inKind, balance: t.balance, fullCost: t.fullCost },
    spendByCategory: (mv.byCategory || []).map((c) => ({ category: c.category, total: c.total })).sort((a, b) => b.total - a.total),
    feedback: {
      n: answers.length, overall: fb.summary.overall, recommend: fb.summary.recommend, nps: fb.summary.nps,
      overallDist: dist("overall", 1, 5), recommendDist: dist("recommend", 0, 10),
      attend: fb.summary.attend, membership: fb.summary.membership, eventEmails: fb.summary.eventEmails,
    },
    emailsDaily: Object.keys(emailDay).sort().map((d) => ({ day: d, n: emailDay[d] })),
    emailsByKind: Object.entries(emailKind).sort((a, b) => b[1] - a[1]).map(([kind, n]) => ({ kind, n })),
    sponsors: sponsorLevels,
    rooms: { people: rooms.length, opened: rooms.filter((r) => r.last_opened_at).length, installed: rooms.filter((r) => r.installed).length, messages: msgs[0]?.n || 0 },
    miva: miva.length ? { places: miva.length, came: miva.filter((x) => came.has(x.id)).length } : null,
  };
}
