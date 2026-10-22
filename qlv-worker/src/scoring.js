// Judges' scoring links and the tally (part 2, feature 4).
//
// Each judge has a long random link, no login. It works on the event day
// only. A table can be scored once the Stage tab has put it on stage, and any
// time after. Tables the judge mentored show as advised and cannot be opened.
// A submitted score locks; only admin can unlock it, with a reason, and every
// unlock is logged. Results are averages of submitted totals, never sums.

import { HttpError, now } from "./index.js";
import { tableName } from "./config.js";
import { getSettings, abujaDay } from "./settings.js";
import { staffPeople, tablesNow, presentationOrder, criteria, tokenRow, ensureToken, linkFor } from "./briefings.js";
import { readStage } from "./stage.js";

const OUTLIVES = (crit) => Math.max(0, crit.findIndex((c) => /outlives the team/i.test(c.name)));

export async function judgesList(env) {
  const people = await staffPeople(env);
  return people.filter((p) => p.judge && p.kind !== "facilitator").map((p, i) => ({
    id: p.id, code: `J${i + 1}`, name: p.name, ref: p.ref,
    advised: p.mentor ? p.tables : [],
  }));
}

// Which tables have been put on stage so far.
function stageReached(stage) {
  const seen = new Set(stage.presented || []);
  if (stage.onStage !== null && stage.onStage !== undefined) seen.add(stage.onStage);
  return seen;
}

async function judgeFor(env, k) {
  const t = await tokenRow(env, k, "scoring");
  if (!t) throw new HttpError(404, "This scoring link is not valid. It may have been replaced: check your brief for the latest one.");
  const judge = (await judgesList(env)).find((j) => j.id === t.ticket_id);
  if (!judge) throw new HttpError(404, "This link is no longer set up for judging. Please speak to the lead facilitator.");
  return { t, judge };
}

function dayCheck(s) {
  if (abujaDay() !== s.event_day) {
    const d = new Date(s.event_day + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    return `Scoring opens on ${d.replace(",", "")}. Keep this link: it is yours for the day.`;
  }
  return null;
}

export async function scoringPage(env, url) {
  const { t, judge } = await judgeFor(env, url.searchParams.get("k"));
  const [s, tables, crit, stage] = await Promise.all([getSettings(env), tablesNow(env), criteria(env), readStage(env)]);
  if (!t.opened_at) await env.DB.prepare("UPDATE access_tokens SET opened_at = ? WHERE id = ?").bind(now(), t.id).run();
  const closed = dayCheck(s);
  const { results } = await env.DB.prepare("SELECT table_index, c1, c2, c3, c4, c5, total, locked FROM scores WHERE judge_ticket_id = ?").bind(judge.id).all();
  const reached = stageReached(stage);
  const teams = presentationOrder(tables, s).map((o) => {
    const sc = results.find((r) => r.table_index === o.index);
    const state = judge.advised.includes(o.index) ? "advised"
      : sc && sc.locked ? "submitted"
      : reached.has(o.index) ? "open" : "waiting";
    return { table: o.index, name: o.name, time: o.time, state, onStage: stage.onStage === o.index, values: sc ? [sc.c1, sc.c2, sc.c3, sc.c4, sc.c5] : null, total: sc?.total ?? null };
  });
  return { judge: { name: judge.name, ref: judge.ref, code: judge.code }, criteria: crit, teams, closed };
}

// Idempotent: sending the same score twice (a retry after bad wifi) is fine.
export async function submitScore(env, b) {
  const { judge } = await judgeFor(env, b.k);
  const s = await getSettings(env);
  const closed = dayCheck(s);
  if (closed) throw new HttpError(403, closed);
  const table = Number(b.table);
  const tables = await tablesNow(env);
  if (!tables.includes(table)) throw new HttpError(404, "That table is not in the competition.");
  if (judge.advised.includes(table)) throw new HttpError(403, "You advised this table, so you do not score it.");
  const stage = await readStage(env);
  if (!stageReached(stage).has(table)) throw new HttpError(409, `${tableName(table)} has not presented yet.`);
  const v = Array.isArray(b.values) ? b.values.map(Number) : [];
  if (v.length !== 5 || v.some((x) => !Number.isInteger(x) || x < 1 || x > 5)) throw new HttpError(400, "Score all five criteria from 1 to 5.");
  const total = v.reduce((a, x) => a + x, 0);
  const cur = await env.DB.prepare("SELECT c1, c2, c3, c4, c5, locked FROM scores WHERE judge_ticket_id = ? AND table_index = ?").bind(judge.id, table).first();
  if (cur && cur.locked) {
    const same = [cur.c1, cur.c2, cur.c3, cur.c4, cur.c5].every((x, i) => x === v[i]);
    if (same) return { ok: true, total, already: true };
    throw new HttpError(409, "Your score for this table is already submitted and locked. If it needs changing, speak to the lead facilitator.");
  }
  await env.DB.prepare(`INSERT INTO scores (judge_ticket_id, table_index, c1, c2, c3, c4, c5, total, submitted_at, locked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT (judge_ticket_id, table_index) DO UPDATE SET c1 = excluded.c1, c2 = excluded.c2, c3 = excluded.c3, c4 = excluded.c4, c5 = excluded.c5,
      total = excluded.total, submitted_at = excluded.submitted_at, locked = 1 WHERE scores.locked = 0`)
    .bind(judge.id, table, ...v, total, now()).run();
  return { ok: true, total };
}

// ---------- the tally, admin only ----------

const mean = (xs) => xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null;
const one = (x) => x === null ? "" : (Math.round(x * 10) / 10).toFixed(1);

export async function computeTally(env) {
  const [s, tables, judges, crit, stage] = await Promise.all([getSettings(env), tablesNow(env), judgesList(env), criteria(env), readStage(env)]);
  const { results } = await env.DB.prepare("SELECT judge_ticket_id, table_index, c1, c2, c3, c4, c5, total, locked, submitted_at, unlocked_by, unlocked_at, unlock_reason FROM scores").all();
  const out = OUTLIVES(crit);
  const reached = stageReached(stage);
  const rows = presentationOrder(tables, s).map((o) => {
    const cells = judges.map((j) => {
      if (j.advised.includes(o.index)) return { kind: "advised" };
      const sc = results.find((r) => r.judge_ticket_id === j.id && r.table_index === o.index);
      if (sc && sc.locked) return { kind: "score", total: sc.total, values: [sc.c1, sc.c2, sc.c3, sc.c4, sc.c5], judge: j.id, unlocked: sc.unlocked_at ? { by: sc.unlocked_by, at: sc.unlocked_at, reason: sc.unlock_reason } : null };
      if (sc && !sc.locked) return { kind: "unlocked", judge: j.id };
      return { kind: reached.has(o.index) ? "waiting" : "none" };
    });
    const scored = cells.filter((c) => c.kind === "score");
    const expected = cells.filter((c) => c.kind !== "advised").length;
    const avg = mean(scored.map((c) => c.total));
    const outl = mean(scored.map((c) => c.values[out]));
    return { index: o.index, name: o.name, time: o.time, onStage: stage.onStage === o.index, cells, avg, outlives: outl, avgText: one(avg), outlivesText: one(outl), complete: expected > 0 && scored.length === expected, scored: scored.length, expected };
  });
  // Highest average first; a tie goes to the higher "Outlives the team" average, then to the judges.
  const order = rows.filter((r) => r.complete).sort((a, b) => b.avg - a.avg || b.outlives - a.outlives);
  order.forEach((r, i) => { r.tied = i > 0 && order[i - 1].avg === r.avg && order[i - 1].outlives === r.outlives; });
  return { rows, order, judges, criteria: crit, outlivesName: crit[out]?.name || "Outlives the team", allComplete: rows.length > 0 && rows.every((r) => r.complete) };
}

export async function tallyView(env) {
  const [t, stage, opened] = await Promise.all([
    computeTally(env), readStage(env),
    env.DB.prepare("SELECT COUNT(DISTINCT ticket_id) AS n FROM access_tokens WHERE kind = 'scoring' AND revoked_at IS NULL AND opened_at IS NOT NULL").first(),
  ]);
  const links = {};
  for (const j of t.judges) links[j.id] = linkFor(env, "scoring", await ensureToken(env, j.id, "scoring"));
  return {
    ...t,
    judges: t.judges.map((j) => ({ ...j, advisedNames: j.advised.map(tableName), link: links[j.id] })),
    strip: { phase: stage.phase, onStage: stage.onStage === null || stage.onStage === undefined ? null : tableName(stage.onStage), complete: t.rows.filter((r) => r.complete).length, teams: t.rows.length, opened: opened.n, judges: t.judges.length },
  };
}

export async function unlockScore(env, b, who) {
  const reason = String(b.reason || "").trim().slice(0, 300);
  if (!reason) throw new HttpError(400, "Give a reason for unlocking. It is kept with the score.");
  const sc = await env.DB.prepare("SELECT * FROM scores WHERE judge_ticket_id = ? AND table_index = ? AND locked = 1").bind(Number(b.judge), Number(b.table)).first();
  if (!sc) throw new HttpError(404, "That score is not locked.");
  const stamp = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE scores SET locked = 0, unlocked_by = ?, unlocked_at = ?, unlock_reason = ? WHERE id = ?").bind(who, stamp, reason, sc.id),
    env.DB.prepare("INSERT INTO score_unlocks (judge_ticket_id, table_index, previous, reason, unlocked_by, unlocked_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(sc.judge_ticket_id, sc.table_index, JSON.stringify({ values: [sc.c1, sc.c2, sc.c3, sc.c4, sc.c5], total: sc.total }), reason, who, stamp),
  ]);
  return tallyView(env);
}
