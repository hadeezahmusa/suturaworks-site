// Tasks, staff roles, mentor routes, role packs, brief links and the printed
// table sheets (part 2, feature 3). Admin screens use the Sutura Works look;
// everything a facilitator, mentor or judge receives is in the QLV look.
//
// The access rule: a brief link shows a holding page until brief_unlock_at.
// Tasks are only ever shown through those links and to signed-in admin, never
// in an email.

import { HttpError, now, token } from "./index.js";
import { tableName, INITIAL_TABLES } from "./config.js";
import { getSettings, abujaLabel, addClock } from "./settings.js";
import { DEFAULT_TEMPLATES, TEMPLATE_KEYS, fill, render, parseCriteria, checkCriteria } from "./templates.js";
import { sendBatch, dailyRoom } from "./mailer.js";
import * as mail from "./emails.js";

const ROLES = { facilitator: "Facilitator", mentor: "Mentor/Advisor", judge: "Judge" };
const clean = (v, max = 2000) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const list = (names) => names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

// ---------- tables ----------

// Tables with people at them, in order. Before anyone is seated, the first six.
export async function tablesNow(env) {
  const { results } = await env.DB.prepare("SELECT DISTINCT table_index AS t FROM tickets WHERE table_index IS NOT NULL AND cancelled_at IS NULL ORDER BY 1").all();
  return results.length ? results.map((r) => r.t) : Array.from({ length: INITIAL_TABLES }, (_, i) => i);
}

// Each table's plan goes to the next; the last goes back to the first.
export function chainOf(tables) {
  return tables.map((t, i) => ({ from: t, to: tables[(i + 1) % tables.length] }));
}

export function presentationOrder(tables, s) {
  const step = s.presentation_minutes + s.changeover_minutes;
  return tables.map((t, i) => ({ index: t, name: tableName(t), time: addClock(s.presentations_start, i * step) }));
}

// ---------- staff and their roles ----------

// Facilitators, advisers (sign-up page) and corporate judges or mentors, with
// what they do on the day. Without a saved row, roles follow how they signed up.
export async function staffPeople(env) {
  const { results } = await env.DB.prepare(`SELECT t.id, t.kind, t.name, t.email, t.ticket_ref, t.created_at, r.mode,
      sr.mentor, sr.judge, sr.facilitator_type, sr.tables, sr.start_table, sr.ticket_id AS saved
    FROM tickets t JOIN registrations r ON r.ref = t.reg_ref LEFT JOIN staff_roles sr ON sr.ticket_id = t.id
    WHERE t.kind IN ('facilitator', 'adviser', 'judge') AND t.cancelled_at IS NULL AND r.status = 'confirmed'
    ORDER BY t.created_at, t.id`).all();
  let leadSeen = false;
  return results.map((p) => {
    const mode = p.kind === "judge" ? "both" : p.mode || "both";
    const out = {
      id: p.id, kind: p.kind, name: p.name, email: p.email, ref: p.ticket_ref,
      mentor: p.saved ? !!p.mentor : p.kind !== "facilitator" && mode !== "judge",
      judge: p.saved ? !!p.judge : p.kind !== "facilitator" && mode !== "adviser",
      facilitatorType: p.kind === "facilitator" ? (p.facilitator_type || null) : null,
      tables: p.tables ? JSON.parse(p.tables) : [],
      startTable: p.start_table,
    };
    if (p.kind === "facilitator") {
      if (!out.facilitatorType) out.facilitatorType = leadSeen ? "floor" : "lead";
      if (out.facilitatorType === "lead") leadSeen = true;
    }
    return out;
  });
}

function saveRow(env, p) {
  return env.DB.prepare(`INSERT INTO staff_roles (ticket_id, mentor, judge, facilitator_type, tables, start_table, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (ticket_id) DO UPDATE SET mentor = excluded.mentor, judge = excluded.judge, facilitator_type = excluded.facilitator_type,
      tables = excluded.tables, start_table = excluded.start_table, updated_at = excluded.updated_at`)
    .bind(p.id, p.mentor ? 1 : 0, p.judge ? 1 : 0, p.facilitatorType, JSON.stringify(p.tables || []), p.startTable ?? null, now());
}

// The pairs: first and second, third and fourth... An odd last table joins the final pair.
export function pairsOf(tables) {
  const pairs = [];
  for (let i = 0; i < tables.length; i += 2) pairs.push(tables.slice(i, i + 2));
  if (pairs.length > 1 && pairs.at(-1).length === 1) pairs[pairs.length - 2].push(pairs.pop()[0]);
  return pairs;
}

// Mentors in sign-up order go round the pairs: one per pair, then a second
// for each pair, who starts on the other table. Floor facilitators share the
// tables in order; the lead covers every table.
export function assignPlan(people, tables) {
  const pairs = pairsOf(tables);
  const mentors = people.filter((p) => p.mentor);
  const plan = {};
  mentors.forEach((m, k) => {
    const pair = pairs[k % pairs.length];
    const nth = Math.floor(k / pairs.length);
    plan[m.id] = { tables: pair, startTable: pair[nth % pair.length] };
  });
  const floors = people.filter((p) => p.kind === "facilitator" && p.facilitatorType === "floor");
  for (const p of people.filter((x) => x.kind === "facilitator")) {
    if (p.facilitatorType === "lead" || !floors.length) { plan[p.id] = { tables, startTable: null }; continue; }
    const i = floors.indexOf(p), per = Math.ceil(tables.length / floors.length);
    plan[p.id] = { tables: tables.slice(i * per, i * per + per), startTable: null };
  }
  return plan;
}

export async function autoAssign(env) {
  const [people, tables] = await Promise.all([staffPeople(env), tablesNow(env)]);
  const plan = assignPlan(people, tables);
  const rows = people.map((p) => saveRow(env, { ...p, ...(plan[p.id] || { tables: [], startTable: null }) }));
  if (rows.length) await env.DB.batch([...rows, env.DB.prepare("UPDATE packs SET stale = 1")]);
  return staffView(env);
}

// A mentor's timed route: every ten minutes from the sprint start, round
// their tables from the one they start on, then off the floor.
export function routeOf(p, s) {
  if (!p.tables?.length) return [];
  const start = Math.max(0, p.tables.indexOf(p.startTable ?? p.tables[0]));
  const slots = Math.floor(s.sprint_minutes / 10);
  const rows = [];
  for (let i = 0; i < slots; i++) rows.push({ time: addClock(s.sprint_start, i * 10), table: tableName(p.tables[(start + i) % p.tables.length]) });
  rows.push({ time: addClock(s.sprint_start, s.sprint_minutes), table: "Sprint ends. Leave the floor" });
  return rows;
}

export async function staffView(env) {
  const [people, tables, s] = await Promise.all([staffPeople(env), tablesNow(env), getSettings(env)]);
  const pairs = pairsOf(tables);
  return {
    people: people.map((p) => ({
      ...p, tableNames: p.tables.map(tableName),
      startName: p.startTable === null || p.startTable === undefined ? "" : tableName(p.startTable),
      route: p.mentor ? routeOf(p, s) : [],
    })),
    pairs: pairs.map((pr) => ({ tables: pr, label: list(pr.map(tableName)) })),
    tables: tables.map((t) => ({ index: t, name: tableName(t) })),
    uncovered: pairs.filter((pr) => !people.some((p) => p.mentor && pr.every((t) => p.tables.includes(t)))).map((pr) => list(pr.map(tableName))),
    spokesperson: s.spokesperson,
  };
}

export async function saveStaffRole(env, b) {
  const people = await staffPeople(env);
  const p = people.find((x) => x.id === Number(b.id));
  if (!p) throw new HttpError(404, "That person is not on the staff list.");
  const tables = await tablesNow(env);
  const next = { ...p };
  if ("mentor" in b) next.mentor = !!b.mentor;
  if ("judge" in b) next.judge = !!b.judge;
  if ("facilitatorType" in b && p.kind === "facilitator") next.facilitatorType = b.facilitatorType === "lead" ? "lead" : "floor";
  if ("tables" in b) {
    const t = (Array.isArray(b.tables) ? b.tables : []).map(Number).filter((x) => tables.includes(x));
    next.tables = [...new Set(t)];
    if (!next.tables.includes(next.startTable)) next.startTable = next.tables[0] ?? null;
  }
  if ("startTable" in b) next.startTable = next.tables.includes(Number(b.startTable)) ? Number(b.startTable) : next.tables[0] ?? null;
  if (!next.mentor && p.kind !== "facilitator") { next.tables = []; next.startTable = null; }
  await env.DB.batch([saveRow(env, next), env.DB.prepare("UPDATE packs SET stale = 1 WHERE ticket_id = ?").bind(p.id)]);
  return staffView(env);
}

// ---------- tasks ----------

const taskDone = (t) => !!(t && t.title && t.situation && t.problem && t.constraints);

export async function tasksView(env) {
  const tables = await tablesNow(env);
  const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
  const by = Object.fromEntries(results.map((t) => [t.table_index, t]));
  const rows = tables.map((t, i) => ({ table: t, name: tableName(t), number: i + 1, ...(by[t] || {}), written: taskDone(by[t]) }));
  // Tasks written for a table that has since closed stay visible, so nothing is lost.
  const orphans = results.filter((t) => !tables.includes(t.table_index)).map((t) => ({ ...t, table: t.table_index, name: tableName(t.table_index), orphan: true }));
  return { tasks: rows, orphans, written: rows.filter((r) => r.written).length };
}

export async function saveTask(env, b, who) {
  const table = Number(b.table);
  if (!Number.isInteger(table) || table < 0 || table > 40) throw new HttpError(400, "Choose a table.");
  const v = { title: clean(b.title, 140), situation: clean(b.situation), problem: clean(b.problem), constraints: clean(b.constraints) };
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO tasks (table_index, title, situation, problem, constraints, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (table_index) DO UPDATE SET title = excluded.title, situation = excluded.situation, problem = excluded.problem,
        constraints = excluded.constraints, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .bind(table, v.title, v.situation, v.problem, v.constraints, now(), who),
    env.DB.prepare("UPDATE packs SET stale = 1"),
  ]);
  return tasksView(env);
}

function tasksBlock(tasks) {
  return tasks.map((t) => [
    `**${t.name} · Task ${t.number}${t.title ? ": " + t.title : ""}**`,
    t.written ? `**The situation.** ${t.situation}\n**The problem to solve.** ${t.problem}\n**What they have to work with.** ${t.constraints}` : "Not written yet.",
  ].join("\n")).join("\n\n");
}

// ---------- templates ----------

export async function templatesAll(env) {
  const { results } = await env.DB.prepare("SELECT key, body, updated_at, updated_by FROM templates").all();
  const saved = Object.fromEntries(results.map((r) => [r.key, r]));
  return TEMPLATE_KEYS.map(([key, label]) => ({ key, label, body: saved[key]?.body ?? DEFAULT_TEMPLATES[key], edited: !!saved[key], updatedAt: saved[key]?.updated_at || null, updatedBy: saved[key]?.updated_by || null }));
}

export async function templateMap(env) {
  return Object.fromEntries((await templatesAll(env)).map((t) => [t.key, t.body]));
}

export async function saveTemplate(env, b, who) {
  if (!DEFAULT_TEMPLATES[b.key]) throw new HttpError(404, "That template does not exist.");
  const body = String(b.body ?? "").replace(/\r/g, "").slice(0, 30000);
  if (!body.trim()) throw new HttpError(400, "A template cannot be empty. Use Reset to go back to the original wording.");
  if (b.key === "criteria") { const err = checkCriteria(body); if (err) throw new HttpError(400, err); }
  if (b.key === "cover_email" && !/^Subject:\s*\S/.test(body)) throw new HttpError(400, 'Start the covering email with a line "Subject: ...".');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO templates (key, body, updated_at, updated_by) VALUES (?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at, updated_by = excluded.updated_by`).bind(b.key, body, now(), who),
    env.DB.prepare("UPDATE packs SET stale = 1"),
  ]);
  return { templates: await templatesAll(env) };
}

export async function resetTemplate(env, b) {
  await env.DB.batch([env.DB.prepare("DELETE FROM templates WHERE key = ?").bind(String(b.key)), env.DB.prepare("UPDATE packs SET stale = 1")]);
  return { templates: await templatesAll(env) };
}

export async function criteria(env) {
  return parseCriteria((await templateMap(env)).criteria);
}

// ---------- links ----------

const LINK_PAGE = { brief: "brief.html", scoring: "score.html", display: "stage.html" };

export function linkFor(env, kind, tok) {
  return `${env.SITE_URL}${LINK_PAGE[kind]}?k=${tok}`;
}

export async function ensureToken(env, ticketId, kind) {
  const row = await env.DB.prepare("SELECT token FROM access_tokens WHERE kind = ? AND revoked_at IS NULL AND ticket_id IS ?").bind(kind, ticketId).first();
  if (row) return row.token;
  const tok = token(32);
  await env.DB.prepare("INSERT INTO access_tokens (ticket_id, kind, token, created_at) VALUES (?, ?, ?, ?)").bind(ticketId, kind, tok, now()).run();
  return tok;
}

export async function tokenRow(env, tok, kind) {
  if (!tok || String(tok).length < 20) return null;
  return env.DB.prepare("SELECT * FROM access_tokens WHERE token = ? AND kind = ? AND revoked_at IS NULL").bind(String(tok), kind).first();
}

// A new link for one person: the old one stops working at once.
export async function reissueToken(env, b) {
  const kind = ["brief", "scoring"].includes(b.kind) ? b.kind : "brief";
  await env.DB.prepare("UPDATE access_tokens SET revoked_at = ? WHERE ticket_id = ? AND kind = ? AND revoked_at IS NULL").bind(now(), Number(b.id), kind).run();
  await ensureToken(env, Number(b.id), kind);
  await env.DB.prepare("UPDATE packs SET stale = 1 WHERE ticket_id = ?").bind(Number(b.id)).run();
  return packsView(env);
}

// ---------- packs ----------

async function sha(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Everything the templates can ask for, for one person in one role.
async function context(env) {
  const [s, tables, people, tpl, tv] = await Promise.all([getSettings(env), tablesNow(env), staffPeople(env), templateMap(env), tasksView(env)]);
  const crit = parseCriteria(tpl.criteria);
  const spokes = people.find((p) => p.id === s.spokesperson && p.judge);
  return { s, tables, people, tpl, tasks: tv.tasks, crit, spokes };
}

async function fieldsFor(env, ctx, p, role) {
  const { s, tables } = ctx;
  const first = p.name.split(/\s+/)[0];
  const f = {
    first_name: first, full_name: p.name, role: ROLES[role], reference: p.ref,
    arrival_time: s.arrival_time[role], unlock_time: abujaLabel(s.brief_unlock_at),
    table_count: tables.length,
    handover_chain: chainOf(tables).map((c) => `${tableName(c.from)} to ${tableName(c.to)}`).join(", "),
    presentation_order: presentationOrder(tables, s).map((o) => `${o.name} ${o.time}`).join(", "),
    chair_name: s.chair_name, chair_phone: s.chair_phone,
    brief_link: linkFor(env, "brief", await ensureToken(env, p.id, "brief")),
    tasks_block: tasksBlock(ctx.tasks),
    criteria_block: ctx.crit.map((c) => `**${c.name}**\n- 1: ${c.anchors[1]}\n- 3: ${c.anchors[3]}\n- 5: ${c.anchors[5]}`).join("\n\n"),
    spokesperson_name: ctx.spokes?.name,
  };
  if (role === "facilitator") {
    f.facilitator_type = p.facilitatorType === "lead" ? "Lead" : "Floor";
    f.tables_covered = list(p.tables.map(tableName)) || null;
  }
  if (role === "mentor") {
    const names = p.tables.map(tableName);
    f.route_table_1 = names.length > 2 ? names.slice(0, -1).join(", ") : names[0];
    f.route_table_2 = names.at(-1);
    if (names.length < 2) { f.route_table_1 = null; f.route_table_2 = null; }
    const route = routeOf(p, s);
    f.route_rows = route.length ? "| Time | Table |\n|---|---|\n" + route.map((r) => `| ${r.time} | ${r.table} |`).join("\n") : null;
  }
  if (role === "judge") {
    const advised = p.mentor ? p.tables.map(tableName) : [];
    f.excluded_tables = advised.length ? list(advised) : "None";
    f.scoring_link = linkFor(env, "scoring", await ensureToken(env, p.id, "scoring"));
  }
  return f;
}

const DOCS = {
  facilitator: [["facilitator_run_sheet", "Run sheet"]],
  mentor: [["mentor_brief", "Brief"], ["mentor_route", "Route card"]],
  judge: [["judge_brief", "Brief"]],
};

function inRole(p, role) {
  return role === "facilitator" ? p.kind === "facilitator" : role === "mentor" ? p.mentor && p.kind !== "facilitator" : p.judge && p.kind !== "facilitator";
}

async function buildPack(env, ctx, p, role) {
  const f = await fieldsFor(env, ctx, p, role);
  const missing = new Set();
  const docs = DOCS[role].map(([key, title]) => {
    const r = fill(ctx.tpl[key], f);
    r.missing.forEach((m) => missing.add(m));
    return { key, title, text: r.text };
  });
  const cover = fill(ctx.tpl.cover_email, f);
  cover.missing.forEach((m) => missing.add(m));
  if (ctx.tasks.some((t) => !t.written)) missing.add("tasks");
  return { name: p.name, ref: p.ref, role, docs, cover: cover.text, link: f.brief_link, missing: [...missing] };
}

export async function generatePacks(env, b) {
  const role = ROLES[b.role] ? b.role : null;
  if (!role) throw new HttpError(400, "Choose facilitators, mentors/advisors or judges.");
  const ctx = await context(env);
  const people = ctx.people.filter((p) => inRole(p, role));
  if (!people.length) throw new HttpError(409, `There is nobody in the ${ROLES[role]} role yet.`);
  const stamp = now();
  const stmts = [];
  for (const p of people) {
    const pack = await buildPack(env, ctx, p, role);
    const content = JSON.stringify(pack);
    const hash = await sha(JSON.stringify({ docs: pack.docs, cover: pack.cover }));
    stmts.push(env.DB.prepare(`INSERT INTO packs (ticket_id, role, content, content_hash, generated_at, stale) VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT (ticket_id, role) DO UPDATE SET content = excluded.content, content_hash = excluded.content_hash, generated_at = excluded.generated_at, stale = 0`)
      .bind(p.id, role, content, hash, stamp));
  }
  // Someone who no longer has this role loses the pack (and is not sent one).
  stmts.push(env.DB.prepare(`DELETE FROM packs WHERE role = ? AND ticket_id NOT IN (SELECT value FROM json_each(?))`).bind(role, JSON.stringify(people.map((p) => p.id))));
  await env.DB.batch(stmts);
  return packsView(env);
}

function packState(row) {
  if (!row) return "none";
  if (!row.sent_at) return row.stale ? "stale" : "ready";
  return row.stale || row.sent_hash !== row.content_hash ? "changed" : "sent";
}

export async function packsView(env) {
  const [people, rows, s, tokens] = await Promise.all([
    staffPeople(env),
    env.DB.prepare("SELECT ticket_id, role, content, content_hash, generated_at, sent_at, sent_hash, stale FROM packs").all().then((r) => r.results),
    getSettings(env),
    env.DB.prepare("SELECT ticket_id, kind, token, opened_at FROM access_tokens WHERE revoked_at IS NULL AND ticket_id IS NOT NULL").all().then((r) => r.results),
  ]);
  const by = (id, role) => rows.find((r) => r.ticket_id === id && r.role === role);
  const tok = (id, kind) => tokens.find((t) => t.ticket_id === id && t.kind === kind);
  const roles = Object.keys(ROLES).map((role) => {
    const ps = people.filter((p) => inRole(p, role));
    const states = ps.map((p) => packState(by(p.id, role)));
    const n = (st) => states.filter((x) => x === st).length;
    const missing = new Set();
    for (const p of ps) { const r = by(p.id, role); if (r) JSON.parse(r.content).missing.forEach((m) => missing.add(m)); }
    return {
      role, label: ROLES[role], count: ps.length,
      contents: { facilitator: "Run sheet for both days", mentor: "Brief, their tables, timed route, the tasks", judge: "Brief, personal scoring link, criteria, the tasks" }[role],
      notGenerated: n("none"), stale: n("stale"), ready: n("ready"), sent: n("sent"), changed: n("changed"),
      missing: [...missing],
      people: ps.map((p) => {
        const r = by(p.id, role), b = tok(p.id, "brief");
        return {
          id: p.id, name: p.name, ref: p.ref, email: p.email, state: packState(r), sentAt: r?.sent_at || null,
          tables: p.tables.map(tableName).join(", "), start: p.startTable === null || p.startTable === undefined ? "" : tableName(p.startTable),
          briefLink: b ? linkFor(env, "brief", b.token) : null, opened: b?.opened_at || null,
          scoringLink: role === "judge" && tok(p.id, "scoring") ? linkFor(env, "scoring", tok(p.id, "scoring").token) : null,
        };
      }),
    };
  });
  return { roles, unlockAt: s.brief_unlock_at, unlockLabel: abujaLabel(s.brief_unlock_at) };
}

// Sends the covering note with the brief link. Every send is confirmed on the
// page first. "changed" resends only packs whose content moved on since sending.
export async function sendPacks(env, b) {
  const role = ROLES[b.role] ? b.role : null;
  if (!role) throw new HttpError(400, "Choose a role.");
  const { results } = await env.DB.prepare("SELECT ticket_id, content, content_hash, sent_at, sent_hash, stale FROM packs WHERE role = ?").bind(role).all();
  if (results.some((r) => r.stale)) throw new HttpError(409, "Something changed since these packs were made. Press Generate packs again first.");
  const people = await staffPeople(env);
  let pick = results;
  if (b.only === "changed") pick = results.filter((r) => r.sent_at && r.sent_hash !== r.content_hash);
  else if (b.only === "unsent") pick = results.filter((r) => !r.sent_at);
  if (b.id) pick = results.filter((r) => r.ticket_id === Number(b.id));
  pick = pick.filter((r) => people.some((p) => p.id === r.ticket_id && p.email));
  if (!pick.length) throw new HttpError(409, "There is no pack to send.");
  const blocked = pick.find((r) => JSON.parse(r.content).missing.length);
  if (blocked) throw new HttpError(409, `${JSON.parse(blocked.content).name}'s pack still has gaps: ${JSON.parse(blocked.content).missing.join(", ")}. Fill them and generate again.`);
  const { room, sent24h } = await dailyRoom(env);
  if (pick.length > room) throw new HttpError(409, `${sent24h} emails have gone out in the last 24 hours. Only ${room} more can go today on the free plan.`);
  const msgs = pick.map((r) => {
    const pack = JSON.parse(r.content);
    const p = people.find((x) => x.id === r.ticket_id);
    const [subjectLine, ...rest] = pack.cover.split("\n");
    const paragraphs = rest.join("\n").trim().split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    return { ref: pack.ref, to: p.email, ...mail.briefCover({ subject: subjectLine.replace(/^Subject:\s*/, "").trim(), paragraphs, link: pack.link, ref: pack.ref }) };
  });
  await sendBatch(env, msgs, `pack_${role}`);
  const stamp = now();
  await env.DB.batch(pick.map((r) => env.DB.prepare("UPDATE packs SET sent_at = ?, sent_hash = content_hash WHERE ticket_id = ? AND role = ?").bind(stamp, r.ticket_id, role)));
  return { sent: pick.length, ...(await packsView(env)) };
}

// ---------- the brief page behind each link ----------

function renderDocs(rows) {
  return rows.flatMap((r) => JSON.parse(r.content).docs.map((d) => ({ title: d.title, role: ROLES[r.role], html: render(d.text) })));
}

export async function briefFor(env, url) {
  const s = await getSettings(env);
  const preview = url.searchParams.get("p");
  let ticketId, role = null;
  if (preview) {
    const v = await env.KV.get(`preview:${preview}`, "json");
    if (!v) throw new HttpError(404, "This preview has expired. Open it again from the admin page.");
    ticketId = v.ticketId; role = v.role;
  } else {
    const t = await tokenRow(env, url.searchParams.get("k"), "brief");
    if (!t) throw new HttpError(404, "This link is not valid. It may have been replaced by a newer one: check your latest email from QLV 2026.");
    ticketId = t.ticket_id;
    if (!t.opened_at) await env.DB.prepare("UPDATE access_tokens SET opened_at = ? WHERE id = ?").bind(now(), t.id).run();
  }
  const person = await env.DB.prepare("SELECT name, ticket_ref FROM tickets WHERE id = ?").bind(ticketId).first();
  if (!person) throw new HttpError(404, "This link is not valid.");
  const base = { name: person.name, ref: person.ticket_ref, unlockLabel: abujaLabel(s.brief_unlock_at) };
  if (!preview && Date.now() < Date.parse(s.brief_unlock_at)) return { ...base, locked: true };
  const { results } = await env.DB.prepare(`SELECT role, content FROM packs WHERE ticket_id = ? ${role ? "AND role = ?" : ""} ORDER BY CASE role WHEN 'facilitator' THEN 0 WHEN 'mentor' THEN 1 ELSE 2 END`)
    .bind(...(role ? [ticketId, role] : [ticketId])).all();
  if (!results.length) return { ...base, locked: false, docs: [], empty: true };
  return { ...base, locked: false, preview: !!preview, docs: renderDocs(results) };
}

// Admin "Preview": a ten-minute link that opens the real brief page, past the lock.
export async function previewLink(env, b) {
  const row = await env.DB.prepare("SELECT 1 FROM packs WHERE ticket_id = ? AND role = ?").bind(Number(b.id), String(b.role)).first();
  if (!row) throw new HttpError(404, "Generate the packs first.");
  const tok = token(24);
  await env.KV.put(`preview:${tok}`, JSON.stringify({ ticketId: Number(b.id), role: String(b.role) }), { expirationTtl: 600 });
  return { url: `${env.SITE_URL}brief.html?p=${tok}` };
}

// ---------- printed table sheets ----------

const SHEETS = [["task_card", "Task card"], ["plan_sheet", "Plan sheet"], ["critique_sheet", "Critique sheet"], ["response_sheet", "Response sheet"]];

export async function sheetsData(env, which) {
  const [tables, tpl, tv] = await Promise.all([tablesNow(env), templateMap(env), tasksView(env)]);
  const chain = chainOf(tables);
  const pick = which === "all" ? tables : tables.filter((t) => t === Number(which));
  if (!pick.length) throw new HttpError(404, "That table is not in use.");
  const missing = new Set();
  const out = pick.map((t) => {
    const task = tv.tasks.find((x) => x.table === t);
    const f = {
      table_name: tableName(t), task_number: task.number,
      task_title: task.title || null, task_context: task.situation || null, task_problem: task.problem || null, task_constraints: task.constraints || null,
      source_table_name: tableName(chain.find((c) => c.to === t).from),
      critic_table_name: tableName(chain.find((c) => c.from === t).to),
    };
    return {
      name: tableName(t),
      pages: SHEETS.map(([key, title]) => {
        const r = fill(tpl[key], f);
        r.missing.forEach((m) => missing.add(`${tableName(t)}: ${m}`));
        return { title, html: render(r.text) };
      }),
    };
  });
  return { tables: out, missing: [...missing] };
}
