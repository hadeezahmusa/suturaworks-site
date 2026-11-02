// The sprint pack (QLV-2026-Sprint-Pack-Build-Spec.md): the six tasks, which
// table works on which, the lock before printing, and what the print packs
// need. Tasks are admin only until brief_unlock_at; nothing here is served
// to any other page. The Harlow & Pike practice case is not a task, lives
// only in the walkthrough guide, and can never be assigned.
//
// The handover chain is the one in briefings.js: each table's plan goes to
// the next table, the last table's to the first. A table critiques the plan
// of the table before it and is critiqued by the table after it, so the rule
// "never critique a plan on your own task" means neighbours in the chain
// must have different tasks.

import { HttpError, now } from "./index.js";
import { tableName } from "./config.js";
import { tablesNow, chainOf, staffPeople, routeOf, templateMap } from "./briefings.js";
import * as P from "./printpack.js";
import { getSettings } from "./settings.js";

const LISTS = ["situation", "people", "work", "out", "strong", "watch"];
const clean = (v, max = 2000) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const parse = (v) => { try { return JSON.parse(v || "[]"); } catch { return []; } };

// ---------- tasks ----------

function fromRow(r) {
  return {
    id: r.id, sort: r.sort, code: r.code, title: r.title, sector: r.sector || "",
    situation: parse(r.situation), people: parse(r.people), problem: r.problem || "", work: parse(r.work),
    out: parse(r.out_of_bounds), working: r.working || "", vulnerability: r.vulnerability || "",
    strong: parse(r.strong), watch: parse(r.watch), updatedAt: r.updated_at, updatedBy: r.updated_by,
  };
}
export async function allTasks(env) {
  return (await env.DB.prepare("SELECT * FROM sprint_tasks ORDER BY sort").all()).results.map(fromRow);
}

// Saving from the Tasks screen. Lists arrive as arrays already split by the page.
export async function saveTask(env, b, who) {
  const row = await env.DB.prepare("SELECT id FROM sprint_tasks WHERE id = ?").bind(String(b.id)).first();
  if (!row) throw new HttpError(404, "No such task.");
  const t = {
    code: clean(b.code, 30), title: clean(b.title, 140), sector: clean(b.sector, 120), problem: clean(b.problem, 600),
    working: clean(b.working, 600), vulnerability: clean(b.vulnerability, 400),
    situation: (b.situation || []).map((x) => clean(x, 800)).filter(Boolean).slice(0, 6),
    people: (b.people || []).map((r) => [0, 1, 2, 3].map((i) => clean(r?.[i], 300))).filter((r) => r[0]).slice(0, 10),
    work: (b.work || []).map((r) => [clean(r?.[0], 40), clean(r?.[1], 400)]).filter((r) => r[0] && r[1]).slice(0, 8),
    out: (b.out || []).map((x) => clean(x, 300)).filter(Boolean).slice(0, 6),
    strong: (b.strong || []).map((x) => clean(x, 300)).filter(Boolean).slice(0, 8),
    watch: (b.watch || []).map((x) => clean(x, 300)).filter(Boolean).slice(0, 6),
  };
  if (!t.code || !t.title || !t.problem) throw new HttpError(400, "A task needs its code, title and problem.");
  await env.DB.prepare(`UPDATE sprint_tasks SET code = ?, title = ?, sector = ?, situation = ?, people = ?, problem = ?, work = ?, out_of_bounds = ?,
      working = ?, vulnerability = ?, strong = ?, watch = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
    .bind(t.code, t.title, t.sector, JSON.stringify(t.situation), JSON.stringify(t.people), t.problem, JSON.stringify(t.work), JSON.stringify(t.out),
      t.working, t.vulnerability, JSON.stringify(t.strong), JSON.stringify(t.watch), now(), who, row.id).run();
  await env.DB.prepare("UPDATE packs SET stale = 1").run();
  return tasksView(env);
}

// ---------- assignment ----------

export async function lockState(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'tasks_locked'").first();
  try { return row ? JSON.parse(row.value) : null; } catch { return null; }
}

// Tables in order with their task, who critiques whom, and any clash.
export async function assignments(env) {
  const [tables, tasks, rows, lock] = await Promise.all([tablesNow(env), allTasks(env), env.DB.prepare("SELECT * FROM table_tasks").all(), lockState(env)]);
  const by = Object.fromEntries(rows.results.map((r) => [r.table_index, r]));
  const taskBy = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const chain = chainOf(tables);
  const list = tables.map((t) => {
    const a = by[t], task = a ? taskBy[a.task_id] : null;
    const from = chain.find((c) => c.to === t).from, to = chain.find((c) => c.from === t).to;
    return { table: t, name: tableName(t), taskId: task?.id || null, code: task?.code || null, title: task?.title || null, assignedBy: a?.assigned_by || null, critiquesPlanOf: from, critiquedBy: to };
  });
  const clashes = [];
  for (const c of chain) {
    const a = list.find((x) => x.table === c.from), b = list.find((x) => x.table === c.to);
    if (a.taskId && a.taskId === b.taskId) clashes.push({ from: a.name, to: b.name, code: a.code });
  }
  return { tables: list, tasks, clashes, locked: lock, complete: list.length > 0 && list.every((x) => x.taskId) };
}

// T1, T2, T3... in table order, adjusted so no table and the table it hands
// to share a task. Least-used task first keeps the six spread evenly.
export function planTasks(tables, taskIds) {
  const out = [], used = Object.fromEntries(taskIds.map((id) => [id, 0]));
  for (let i = 0; i < tables.length; i++) {
    const avoid = new Set();
    if (i > 0) avoid.add(out[i - 1]);
    if (i === tables.length - 1 && i > 0) avoid.add(out[0]);
    const pick = [...taskIds].sort((a, b) => used[a] - used[b] || taskIds.indexOf(a) - taskIds.indexOf(b)).find((id) => !avoid.has(id)) || taskIds[i % taskIds.length];
    out.push(pick);
    used[pick]++;
  }
  return out;
}

async function mustBeUnlocked(env) {
  if (await lockState(env)) throw new HttpError(409, "Tasks are locked. Unlock them first to make changes.");
}

export async function autoAssign(env, who) {
  await mustBeUnlocked(env);
  const [tables, tasks] = await Promise.all([tablesNow(env), allTasks(env)]);
  const plan = planTasks(tables, tasks.map((t) => t.id));
  const stamp = now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM table_tasks"),
    ...tables.map((t, i) => env.DB.prepare("INSERT INTO table_tasks (table_index, task_id, assigned_by, assigned_at) VALUES (?, ?, 'auto', ?)").bind(t, plan[i], stamp)),
    env.DB.prepare("UPDATE packs SET stale = 1"),
  ]);
  return assignments(env);
}

export async function setTableTask(env, b) {
  await mustBeUnlocked(env);
  const table = Number(b.table);
  const tables = await tablesNow(env);
  if (!tables.includes(table)) throw new HttpError(404, "That table is not in use.");
  const task = await env.DB.prepare("SELECT id FROM sprint_tasks WHERE id = ?").bind(String(b.taskId)).first();
  if (!task) throw new HttpError(404, "Choose one of the six tasks.");
  await env.DB.batch([
    env.DB.prepare("INSERT INTO table_tasks (table_index, task_id, assigned_by, assigned_at) VALUES (?, ?, 'admin', ?) ON CONFLICT (table_index) DO UPDATE SET task_id = excluded.task_id, assigned_by = 'admin', assigned_at = excluded.assigned_at")
      .bind(table, task.id, now()),
    env.DB.prepare("UPDATE packs SET stale = 1"),
  ]);
  return assignments(env);
}

export async function setLock(env, b, who) {
  if (b.lock) {
    const a = await assignments(env);
    if (!a.complete) throw new HttpError(409, "Give every table a task before locking.");
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('tasks_locked', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
      .bind(JSON.stringify({ at: now(), by: who }), now(), who).run();
  } else {
    await env.DB.prepare("DELETE FROM settings WHERE key = 'tasks_locked'").run();
  }
  return assignments(env);
}

export async function tasksView(env) {
  return assignments(env);
}

// The tasks in use, in task order, for the judges' and mentors' notes.
export async function tasksInUse(env) {
  const a = await assignments(env);
  const ids = new Set(a.tables.map((x) => x.taskId).filter(Boolean));
  return a.tasks.filter((t) => ids.has(t.id));
}

// ---------- what the print packs need ----------

const SHA = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 20);

export async function printContext(env) {
  const [a, people, s] = await Promise.all([assignments(env), staffPeople(env), getSettings(env)]);
  const taskBy = Object.fromEntries(a.tasks.map((t) => [t.id, t]));
  const inUse = a.tasks.filter((t) => a.tables.some((x) => x.taskId === t.id));
  const judges = people.filter((p) => p.judge && p.kind !== "facilitator").map((p) => ({
    id: p.id, name: p.name, excluded: p.mentor ? p.tables.map(tableName) : [],
  }));
  const mentors = people.filter((p) => p.mentor && p.kind !== "facilitator").map((p) => ({
    id: p.id, name: p.name, route: routeOf(p, s),
    tables: p.tables.map((t) => ({ name: tableName(t), task: taskBy[a.tables.find((x) => x.table === t)?.taskId] || null })),
  }));
  return { ...a, taskBy, inUse, judges, mentors, s };
}

// A short fingerprint of everything a pack prints, so a later change can be
// flagged as "changed since download".
export async function signatureOf(ctx, kind, target) {
  const tbl = (t) => { const x = ctx.tables.find((r) => r.table === t); return x && { n: x.name, t: ctx.taskBy[x.taskId], f: x.critiquesPlanOf, b: x.critiquedBy }; };
  let data;
  if (kind === "table") data = tbl(Number(target));
  else if (kind === "all") data = ctx.tables.map((x) => tbl(x.table));
  else if (kind === "spares") data = ctx.tables.length;
  else if (kind === "judge") data = { j: ctx.judges.find((j) => String(j.id) === String(target)), u: ctx.inUse, t: ctx.tables.map((x) => x.name) };
  else if (kind === "judges") data = { j: ctx.judges, u: ctx.inUse, t: ctx.tables.map((x) => x.name) };
  else if (kind === "mentor") data = ctx.mentors.find((m) => String(m.id) === String(target));
  else if (kind === "mentors") data = { m: ctx.mentors, u: ctx.inUse };
  return SHA(JSON.stringify(data ?? null));
}

export async function logDownload(env, ctx, kind, target, who) {
  await env.DB.prepare("INSERT INTO print_downloads (kind, target, signature, downloaded_at, downloaded_by) VALUES (?, ?, ?, ?, ?)")
    .bind(kind, String(target), await signatureOf(ctx, kind, target), now(), who || null).run();
}

// For the Print section: each pack, when it was last downloaded and whether
// it has changed since.
export async function printStatus(env) {
  const ctx = await printContext(env);
  const { results } = await env.DB.prepare("SELECT kind, target, signature, downloaded_at FROM print_downloads WHERE id IN (SELECT MAX(id) FROM print_downloads GROUP BY kind, target)").all();
  const last = Object.fromEntries(results.map((r) => [`${r.kind}:${r.target}`, r]));
  const item = async (kind, target, label) => {
    const l = last[`${kind}:${target}`];
    return { kind, target: String(target), label, downloadedAt: l?.downloaded_at || null, changed: !!l && l.signature !== (await signatureOf(ctx, kind, target)) };
  };
  return {
    locked: ctx.locked, complete: ctx.complete, clashes: ctx.clashes,
    tables: await Promise.all(ctx.tables.map((x) => item("table", x.table, x.name))),
    all: await item("all", "all", "All table packs"),
    spares: await item("spares", "spares", "Spare sheets"),
    judges: await Promise.all(ctx.judges.map((j) => item("judge", j.id, j.name))),
    mentors: await Promise.all(ctx.mentors.map((m) => item("mentor", m.id, m.name))),
  };
}

// ---------- the walkthrough guide ----------

export async function guideRedirect(env) {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('guide_downloads', '1', ?) ON CONFLICT (key) DO UPDATE SET value = CAST(value AS INTEGER) + 1, updated_at = excluded.updated_at").bind(now()).run();
  return new Response(null, { status: 302, headers: { location: `${env.SITE_URL}files/QLV-2026-How-The-Sprint-Works.pdf`, "cache-control": "no-store" } });
}
export async function guideDownloads(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'guide_downloads'").first();
  return Number(row?.value) || 0;
}

// ---------- the print pages ----------

// One pack as a print-ready page. Packs open only once tasks are locked, so
// what is printed matches what the tables, judges and mentors were given;
// each opening is logged so a later change can be flagged.
export async function packPage(env, q, who) {
  const kind = String(q.get("kind") || ""), target = String(q.get("t") || q.get("id") || kind);
  const ctx = await printContext(env);
  const site = env.SITE_URL;
  if (!ctx.locked) return P.packDocument("Not ready", `<section class="page"><div class="body"><h1>Lock the tasks first</h1><p>Print packs open once every table has its task and the tasks are locked on the Tables page, so the printed sheets match.</p></div></section>`);
  const crit = (await templateMap(env)).criteria;
  let title, html;
  if (kind === "table") {
    const x = ctx.tables.find((r) => String(r.table) === target);
    if (!x) throw new HttpError(404, "That table is not in use.");
    title = `${x.name} table pack`; html = P.tablePack(site, ctx, x);
  } else if (kind === "all") {
    title = "All table packs"; html = ctx.tables.map((x) => P.tablePack(site, ctx, x)).join("");
  } else if (kind === "spares") {
    title = "Spare sheets"; html = P.sparesPack(site, ctx);
  } else if (kind === "judge" || kind === "judges") {
    const list = kind === "judges" ? ctx.judges : ctx.judges.filter((j) => String(j.id) === target);
    if (!list.length) throw new HttpError(404, "No such judge.");
    title = kind === "judges" ? "All judge packs" : `Judge pack · ${list[0].name}`;
    html = list.map((j) => P.judgeGuide(site, ctx, j, crit) + P.scoringSheet(site, ctx, j)).join("");
  } else if (kind === "mentor" || kind === "mentors") {
    const list = kind === "mentors" ? ctx.mentors : ctx.mentors.filter((m) => String(m.id) === target);
    if (!list.length) throw new HttpError(404, "No such mentor.");
    title = kind === "mentors" ? "All mentor packs" : `Mentor pack · ${list[0].name}`;
    html = list.map((m) => P.mentorGuide(site, ctx) + P.routeCard(site, m)).join("");
  } else throw new HttpError(404, "Unknown pack.");
  // Packs for everyone log each person's pack too, so their flags clear.
  if (kind === "judges") for (const j of ctx.judges) await logDownload(env, ctx, "judge", j.id, who);
  else if (kind === "mentors") for (const m of ctx.mentors) await logDownload(env, ctx, "mentor", m.id, who);
  else if (kind === "all") for (const x of ctx.tables) await logDownload(env, ctx, "table", x.table, who);
  if (!["judges", "mentors"].includes(kind)) await logDownload(env, ctx, kind, kind === "all" || kind === "spares" ? kind : target, who);
  const warn = ctx.clashes.length ? `Check: ${ctx.clashes.map((c) => `${c.from} hands to ${c.to}, both ${c.code}`).join("; ")}` : "";
  return P.packDocument(title, html, { warn, pages: P.countPages(html) });
}

// The Tasks screen preview of one printed card, admin only, any time.
export async function taskCardPreview(env, id) {
  const a = await assignments(env);
  const t = a.tasks.find((x) => x.id === id);
  if (!t) throw new HttpError(404, "No such task.");
  const onTable = a.tables.find((x) => x.taskId === id);
  return P.packDocument(`${t.code} card preview`, P.taskCard(env.SITE_URL, onTable?.name || null, t));
}
