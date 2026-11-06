// Print-ready pages for the sprint pack, laid out to the reference designs
// in QLV-2026-Sprint-Pack-Bundle: A4 pages with the navy band, the white JCI
// Aso and QLV logos, Poppins, Source Sans 3 and IBM Plex Mono. No footers.
// Admin opens a pack and prints it or saves it as a PDF from the browser.

import { parseCriteria } from "./templates.js";

const e = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const BLANK = "______________";

const CSS = String.raw`
@page { size: A4 portrait; margin: 0; }
@page land { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #DDE4EE; font-family: "Source Sans 3", "Segoe UI", Arial, sans-serif; color: #0E1B33; }
.page { width: 210mm; height: 297mm; margin: 8mm auto; background: #fff; overflow: hidden; display: flex; flex-direction: column; break-after: page; position: relative; }
.page.land { width: 297mm; height: 210mm; page: land; }
.band { height: 23mm; flex: none; background: linear-gradient(180deg, #0F2B63, #0A1F4D); display: flex; align-items: center; justify-content: space-between; padding: 0 13mm; color: #fff; }
.band .logos { display: flex; align-items: center; gap: 3.2mm; }
.band .logos img.jci { height: 7.6mm; } .band .logos img.qlv { height: 8.2mm; }
.band .logos .rule { width: .3mm; height: 7.5mm; background: rgba(255,255,255,.45); }
.band .r { text-align: right; }
.band .r b { display: block; font-family: Poppins, sans-serif; font-size: 13.5pt; font-weight: 700; line-height: 1.15; }
.band .r span { display: block; font-family: "IBM Plex Mono", monospace; font-size: 6.4pt; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: #EFC22D; margin-top: 1.3mm; }
.body { flex: 1; padding: 6mm 13mm 6mm; display: flex; flex-direction: column; min-height: 0; }
.kick { font-family: "IBM Plex Mono", monospace; font-size: 6.6pt; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: #1F7D87; }
h1 { font-family: Poppins, sans-serif; font-weight: 800; font-size: 19pt; line-height: 1.1; color: #0F2B63; margin: .6mm 0 3mm; letter-spacing: -.01em; }
h2 { font-family: Poppins, sans-serif; font-weight: 700; font-size: 10.5pt; color: #0F2B63; margin: 4.2mm 0 1.6mm; }
h2.rule { font-size: 12pt; border-bottom: .35mm solid #0F2B63; padding-bottom: 1.6mm; margin: 5mm 0 0; }
p { font-size: 8.6pt; line-height: 1.45; margin: 0 0 1.6mm; }
ul { margin: 0; padding-left: 4.5mm; } li { font-size: 8.6pt; line-height: 1.45; margin: 0 0 1.1mm; }
.muted { color: #4A5B75; }
table.t { width: 100%; border-collapse: collapse; font-size: 8pt; }
table.t th { font-family: "IBM Plex Mono", monospace; font-size: 5.8pt; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: #4A5B75; text-align: left; padding: 2.4mm 1.6mm 1.6mm; border-bottom: .35mm solid #0E1B33; }
table.t td { padding: 1.6mm; border-bottom: .2mm solid #D3DEEA; vertical-align: top; line-height: 1.35; }
table.t td.b { font-weight: 700; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
.panel { background: #EEF3F9; border-radius: 2mm; padding: 3mm 3.6mm; }
.panel h2 { margin-top: 0; }
.note { background: #FDF3D6; border-radius: 2mm; padding: 2.6mm 3.6mm; font-size: 8.3pt; line-height: 1.45; margin-top: 4.5mm; }
.covers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 2mm; }
.covers div { border: .25mm solid #C9D6E6; border-radius: 1.6mm; padding: 2mm 2.2mm; font-size: 7.3pt; line-height: 1.35; color: #4A5B75; }
.covers b { display: block; font-family: Poppins, sans-serif; font-size: 8pt; color: #0F2B63; }
/* writing boxes */
.box { border: .35mm solid #1B2F66; border-radius: 2.6mm; display: flex; flex-direction: column; overflow: hidden; margin: 0 0 3.3mm; }
.box:last-child { margin-bottom: 0; }
.box .hd { background: #F3F6FB; border-bottom: .2mm solid #D3DEEA; height: 9.4mm; flex: none; display: flex; align-items: center; gap: 2.6mm; padding: 0 3.3mm; }
.box .hd b { font-family: Poppins, sans-serif; font-size: 10pt; color: #0F2B63; flex: 1; }
.box .hd i { font-style: normal; font-size: 7pt; color: #4A5B75; }
.num { width: 5.2mm; height: 5.2mm; border-radius: 50%; background: #EFC22D; color: #0F2B63; font-family: Poppins, sans-serif; font-weight: 700; font-size: 6.6pt; display: flex; align-items: center; justify-content: center; flex: none; }
.num.teal { background: #5DBDC6; color: #0F2B63; }
.lines { flex: 1; display: flex; flex-direction: column; padding: 0 3.3mm; }
.lines div { flex: 1; border-bottom: .25mm solid #C9D6E6; font-size: 6.3pt; color: #8FB6E8; display: flex; align-items: flex-end; padding-bottom: 1mm; }
.owners { flex: 1; display: grid; grid-template-columns: 50% 25% 25%; grid-auto-rows: 1fr; padding: 0 3.3mm 2mm; }
.owners > div { border-bottom: .25mm solid #C9D6E6; }
.owners > div:nth-child(3n+2), .owners > div:nth-child(3n) { border-left: .25mm solid #C9D6E6; padding-left: 1.6mm; }
.owners > .h { font-family: "IBM Plex Mono", monospace; font-size: 5.6pt; letter-spacing: .12em; color: #4A5B75; border-bottom: .35mm solid #0E1B33; display: flex; align-items: center; height: 6.5mm; }
.rows { flex: 1; display: flex; flex-direction: column; padding: 0 3.3mm; }
.rows > div { flex: 1; display: flex; border-bottom: .25mm solid #C9D6E6; }
.rows > div:last-child { border-bottom: 0; }
.rows span { width: 22mm; flex: none; border-right: .25mm solid #C9D6E6; font-family: "IBM Plex Mono", monospace; font-size: 5.8pt; font-weight: 600; letter-spacing: .1em; color: #1F7D87; padding-top: 1.8mm; }
.intro { font-size: 7.9pt; color: #4A5B75; margin: 0 0 3.3mm; line-height: 1.45; }
.intro b { color: #0F2B63; }
/* tent card */
.tent { flex: 1; background: linear-gradient(180deg, #0F2B63 0%, #0A1F4D 50%, #0F2B63 100%); display: flex; flex-direction: column; }
.tent > div { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; }
.tent .flip { transform: rotate(180deg); }
.tent b { font-family: Poppins, sans-serif; font-weight: 800; font-size: 64pt; line-height: 1; letter-spacing: -.01em; }
.tent span { font-family: "IBM Plex Mono", monospace; font-size: 10pt; font-weight: 600; letter-spacing: .24em; color: #EFC22D; margin-top: 6mm; }
/* judges */
.jt { margin: 0 0 6mm; }
.jt .h { display: flex; align-items: baseline; gap: 2mm; flex-wrap: wrap; }
.jt .h b { font-family: Poppins, sans-serif; font-size: 10pt; color: #0F2B63; }
.chip { font-family: "IBM Plex Mono", monospace; font-size: 5.8pt; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; background: #E6EDF6; color: #0F2B63; padding: .8mm 1.8mm; border-radius: 1mm; }
.jt h4 { font-size: 8.4pt; margin: 2mm 0 1mm; font-weight: 700; }
table.score { width: 100%; border-collapse: collapse; font-size: 8pt; }
table.score th { font-family: "IBM Plex Mono", monospace; font-size: 5.6pt; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; color: #4A5B75; background: #F3F6FB; border: .25mm solid #C9D6E6; padding: 2mm 1.4mm; text-align: center; }
table.score th:first-child { text-align: left; }
table.score td { border: .25mm solid #C9D6E6; height: 13.4mm; vertical-align: top; padding: 1.6mm 1.8mm; }
table.score td:first-child { font-weight: 700; width: 36mm; }
table.score tr.out td { background: #E9ECF1; color: #6B7A90; }
/* screen only */
.bar { position: sticky; top: 0; z-index: 2; background: #0F2B63; color: #fff; padding: 10px 16px; font: 13px Arial, sans-serif; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.bar button { font: inherit; font-weight: 700; padding: 8px 14px; border: 0; border-radius: 6px; background: #EFC22D; color: #0F2B63; cursor: pointer; }
.bar .warn { background: #F5E6E1; color: #8A2A20; padding: 4px 8px; border-radius: 5px; }
@media print { body { background: #fff; } .page { margin: 0; } .bar { display: none; } }
`;

// ---------- pieces ----------

function band(site, title, sub) {
  return `<div class="band"><div class="logos"><img class="jci" src="${site}assets/jci-aso-white.png" alt="JCI Aso"><span class="rule"></span><img class="qlv" src="${site}assets/qlv-white.png" alt="Quality Leadership Value"></div>
  <div class="r"><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div></div>`;
}
const page = (site, title, sub, body, land = false) => `<section class="page${land ? " land" : ""}">${band(site, title, sub)}<div class="body">${body}</div></section>`;
const lines = (n, numbered = false) => `<div class="lines">${Array.from({ length: n }, (_, i) => `<div>${numbered ? i + 1 : ""}</div>`).join("")}</div>`;
function box(num, title, hint, inner, mm, teal = false) {
  return `<div class="box" style="${mm ? `height:${mm}mm;flex:none` : "flex:1"}"><div class="hd"><span class="num${teal ? " teal" : ""}">${num}</span><b>${title}</b>${hint ? `<i>${hint}</i>` : ""}</div>${inner}</div>`;
}
const rows = (labels) => `<div class="rows">${labels.map((l) => `<div><span>${l}</span></div>`).join("")}</div>`;
const STAR = '<svg width="8" height="8" viewBox="0 0 24 24" fill="#0F2B63" aria-hidden="true"><path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.5l7.1-.6z"/></svg>';

// ---------- table sheets ----------

export function tentCard(site, name) {
  return `<section class="page land"><div class="tent"><div class="flip"><b>${e(name)}</b><span>QLV 2026 · TEAM TABLE</span></div><div><b>${e(name)}</b><span>QLV 2026 · TEAM TABLE</span></div></div></section>`;
}

export function taskCard(site, tableName, t) {
  const people = `<table class="t"><thead><tr><th style="width:23%">Role</th><th style="width:7%">No.</th><th>What they do now</th><th style="width:19%">Spare capacity</th></tr></thead><tbody>${
    t.people.map((r) => `<tr><td class="b">${e(r[0])}</td><td>${e(r[1])}</td><td>${e(r[2])}</td><td>${e(r[3])}</td></tr>`).join("")}</tbody></table>`;
  const body = `<div class="kick">${e(t.sector)}</div><h1>${e(t.title)}</h1>
  <h2>The situation</h2>${t.situation.map((x) => `<p>${e(x)}</p>`).join("")}
  <h2>The people</h2>${people}
  <h2>The problem to solve</h2><p>${e(t.problem)}</p>
  <div class="cols" style="margin-top:2mm"><div><h2>What you have to work with</h2><ul>${t.work.map(([k, v]) => `<li><b>${e(k)}:</b> ${e(v)}</li>`).join("")}</ul></div>
    <div><div class="panel" style="margin-top:3mm"><h2>Out of bounds</h2><ul>${t.out.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>
    <h2>What working looks like</h2><p>${e(t.working)}</p></div></div>
  <div class="note"><b>If it isn't on this card, it doesn't exist.</b> Don't assume extra people, money, tools or time. <b>You may make up to two assumptions.</b> Write them on your plan sheet. The team that critiques your plan may challenge them.<br><b>The test:</b> at 11:40 your plan goes to another team. They have to understand it without you.</div>
  <h2 style="margin-top:4.5mm">Your plan must cover</h2>
  <div class="covers"><div><b>1 Problem</b>What is going wrong, and why?</div><div><b>2 Approach</b>Steps a stranger could follow</div><div><b>3 Who does what</b>An owner and a backup for each step</div><div><b>4 Risks</b>What could stop it, and your answer</div><div><b>5 First 30 days</b>What happens first, and how you'll know</div></div>`;
  return page(site, tableName ? `Table: ${e(tableName)}` : `Table: ${BLANK}`, `Task card · ${e(t.code)}`, body);
}

export function planSheet(site, tableName, code) {
  const head = tableName ? `Table: ${e(tableName)}` : `Table: ${BLANK}`;
  const task = code ? e(code) : "Task ___";
  const p1 = box(1, "Problem", "What is going wrong, and why? Name the root cause, not the symptom", lines(8), 75) +
    box("A", "Our assumptions", "Up to two. Anything you assumed that isn't on the card", lines(2, true), 31) +
    box(2, "Approach", "Numbered steps someone outside your team could follow", lines(10, true));
  const owners = `<div class="owners"><div class="h">STEP OR DUTY</div><div class="h">OWNER</div><div class="h">BACKUP</div>${"<div></div>".repeat(21)}</div>`;
  const p2 = box(3, "Who does what", "An owner and a backup for every step", owners, 98) +
    box(4, "Risks", "What could stop it working, and what you'll do about it", lines(8), 76) +
    box(5, "First 30 days", "What happens first, and how you'll know it's working", lines(9));
  return page(site, head, `Plan sheet · ${task} · Page 1 of 2`, p1) + page(site, head, `Plan sheet · ${task} · Page 2 of 2`, p2);
}

export function critiqueSheet(site, tableName, fromName) {
  const head = tableName ? `Critique by ${e(tableName)}` : `Critique by ${BLANK}`;
  const sub = (n) => `Critique sheet · of the plan from ${fromName ? e(fromName) : BLANK} · Page ${n} of 2`;
  const three = (n, t) => box(n, t, "", rows(["GAP", "QUESTION", "STRENGTH"]), null, true);
  const p1 = `<p class="intro">You are reviewing a plan written by another team. For each section, name one <b>gap</b> (what is missing or won't work), one <b>question</b> you would need answered before you could run it and one <b>strength</b> they should keep. Be specific: point to the line.</p>` +
    three(1, "Problem") + three(2, "Approach") + three(3, "Who does what");
  const p2 = box(4, "Risks", "", rows(["GAP", "QUESTION", "STRENGTH"]), 74, true) + box(5, "First 30 days", "", rows(["GAP", "QUESTION", "STRENGTH"]), 74, true) +
    box("A", "Their assumptions", "", rows(["FAIR?", "CHALLENGE"]), 54, true) + box(STAR, "The one change that would make this plan strongest", "", lines(5), null, true);
  return page(site, head, sub(1), p1) + page(site, head, sub(2), p2);
}

export function responseSheet(site, tableName, criticName) {
  const head = tableName ? `Table: ${e(tableName)}` : `Table: ${BLANK}`;
  const body = `<p class="intro">Fifteen minutes. You don't have to agree with every point. You do have to answer it. Update your A2 board with any changes, because you present from it.</p>` +
    box(1, "What we're changing", "Which points we accepted, and how the plan changes", lines(11), 95) +
    box(2, "What we're keeping", "Which points we disagree with, and why", lines(7), 70) +
    box(3, "Our assumptions", "If they were challenged: keep, change or drop, and why", lines(4), 42) +
    box(4, "One question back", "The one thing we'd still ask our critics", lines(3));
  return page(site, head, `Response sheet · to the critique from ${criticName ? e(criticName) : BLANK}`, body);
}

// One table's pack, in the order of the spec: tent, two task cards, two plan
// sets, one critique set, one response sheet.
export function tablePack(site, ctx, x) {
  const t = ctx.taskBy[x.taskId];
  const from = ctx.tables.find((r) => r.table === x.critiquesPlanOf)?.name, to = ctx.tables.find((r) => r.table === x.critiquedBy)?.name;
  return tentCard(site, x.name) + taskCard(site, x.name, t).repeat(2) + planSheet(site, x.name, t.code).repeat(2) + critiqueSheet(site, x.name, from) + responseSheet(site, x.name, to);
}
export function sparesPack(site, ctx) {
  const n = Math.max(1, ctx.tables.length);
  return planSheet(site, null, null).repeat(3 * n) + critiqueSheet(site, null, null).repeat(2 * n) + responseSheet(site, null, null).repeat(2 * n);
}

// ---------- judges ----------

export function judgeGuide(site, ctx, judge, criteriaText) {
  const crit = parseCriteria(criteriaText);
  const day = [["9:45am", "Arrive, collect your badge and your scoring link"], ["12:35pm", "Lunch. Each table's plan, critique and response sheets reach the judges' table to read"],
    ["1:30pm", "Presentations, 3 to 5 minutes each, from the team's A2 board. Score each team straight after it presents"], ["About 2:35pm", "All scores in. The tally is checked"],
    ["2:50pm", "The panel's spokesperson gives feedback and the top three are announced"]];
  const p1 = `<div class="kick">For judges</div><h1>How to judge the sprint</h1>
  <p><b>Your role in one line.</b> You decide whether each team's plan would work without the people who wrote it, and how well they made the case.</p>
  <h2 class="rule">Your day</h2><table class="t"><thead><tr><th style="width:18%">Time</th><th>What happens</th></tr></thead><tbody>${day.map(([a, b]) => `<tr><td class="b">${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>
  <h2 class="rule">How to score</h2><ul style="margin-top:2mm">
    <li>Score each criterion 1, 3 or 5. Use 2 or 4 when a team is in between.</li>
    <li>Score on your phone with your personal link. If the link fails, use the printed scoring sheet and hand it to the Lead Sprint Marshal.</li>
    <li>You don't score tables you mentored during the sprint. Your link won't show them.</li>
    <li><b>Tables you don't score: ${e(judge.excluded.length ? judge.excluded.join(" and ") : "None")}</b></li>
    <li>Each team's result is the average of its judges' totals. Ties go to the higher average on <b>Outlives the team</b>, then to the judges together.</li>
    <li>Teams may have made up to two stated assumptions. Judge whether they were reasonable, not whether they existed.</li></ul>
  <h2 class="rule">The five criteria</h2><table class="t"><thead><tr><th style="width:17%">Criterion</th><th>1</th><th>3</th><th>5</th></tr></thead><tbody>${
    crit.map((c) => `<tr><td class="b">${e(c.name)}</td><td>${e(c.anchors[1])}</td><td>${e(c.anchors[3])}</td><td>${e(c.anchors[5])}</td></tr>`).join("")}</tbody></table>
  <p style="margin-top:2.5mm;color:#4A5B75"><b style="color:#1A5AA8">Outlives the team</b> is the theme criterion and the tie-breaker.</p>`;
  const note = (t) => `<div class="jt"><div class="h"><b>${e(t.code)} · ${e(t.title)}</b><span class="chip">${e(t.sector)}</span></div>
    <p style="margin-top:1.4mm"><b>The single point of failure:</b> ${e(t.vulnerability)}</p>
    <div class="cols" style="gap:5mm"><div><h4>Strong plans usually</h4><ul>${t.strong.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div><div><h4>Watch for</h4><ul>${t.watch.map((x) => `<li>${e(x)}</li>`).join("")}</ul></div></div></div>`;
  const pages = [];
  for (let i = 0; i < ctx.inUse.length; i += 3) pages.push(ctx.inUse.slice(i, i + 3));
  const sub = (list) => `The tasks · ${list[0].code.replace(/^Task\s*/, "")}${list.length > 1 ? " to " + list.at(-1).code.replace(/^Task\s*/, "") : ""}`;
  return page(site, "Judges' guide", "QLV 2026 · Day two", p1) + pages.map((list, i) => page(site, "Judges' guide", sub(list),
    (i === 0 ? `<p class="muted" style="margin-bottom:4mm">Each table worked on one of these. Use the notes to see what a strong answer looks like. They are a guide, not a checklist: a plan that solves the problem in a way not listed here can still score 5.</p>` : "") + list.map(note).join(""))).join("");
}

export function scoringSheet(site, ctx, judge) {
  const out = new Set(judge.excluded);
  const head = ["Table", "Problem understood", "A plan someone else could run", "Outlives the team", "Used the critique", "Delivered clearly", "Total /25", "Note"];
  const body = `<p class="intro" style="margin-bottom:4mm">Use only if your scoring link fails. Write 1 to 5 in each box. Leave tables you mentored blank. Hand this to the Lead Sprint Marshal as soon as presentations end.</p>
  <table class="score"><thead><tr>${head.map((h, i) => `<th style="${i === 6 ? "width:15mm" : i === 7 ? "width:34mm" : ""}">${h}</th>`).join("")}</tr></thead><tbody>${
    ctx.tables.map((x) => out.has(x.name) ? `<tr class="out"><td>${e(x.name)}</td><td colspan="7" style="vertical-align:middle">You mentored this table</td></tr>` : `<tr><td>${e(x.name)}</td>${"<td></td>".repeat(7)}</tr>`).join("")}</tbody></table>
  <p class="muted" style="margin-top:3mm;font-size:7.6pt"><b>1</b> weak · <b>3</b> sound with gaps · <b>5</b> strong. Use 2 or 4 when in between. Full descriptions are in your judges' guide.</p>`;
  return page(site, "Backup scoring sheet", `Judge: ${e(judge.name)}`, body, true);
}

// ---------- mentors ----------

export function mentorGuide(site, ctx) {
  const n = ctx.inUse.length;
  const body = `<div class="kick">For mentors and advisors</div><h1>Help them think. Don't write it for them.</h1>
  <p>You look after two tables for the whole sprint, moving between them every ten minutes. Your route card shows which.</p>
  <h2 class="rule">Your day</h2><table class="t"><thead><tr><th style="width:28%">Time</th><th>What happens</th></tr></thead><tbody>${[
    ["9:45am", "Arrive and collect your badge and route card"], ["10:50 to 11:40am", "The sprint. Ten minutes at each of your tables in turn"],
    ["11:40am to 12:35pm", "Handover, critique and response. You're off the floor"], ["12:35pm", "Lunch"],
    ["1:30pm", "Presentations. If you are also a judge, you don't score your two tables"]].map(([a, b]) => `<tr><td class="b">${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>
  <div class="cols"><div><h2 class="rule">Do</h2><ul style="margin-top:2mm"><li>Ask before you suggest. "Who owns that step?" does more than "assign an owner".</li><li>Push them towards the test: could someone outside this table run this tomorrow?</li><li>Check they are using the A2 board, not one person's notebook.</li><li>Ask what they have assumed, and whether it is on the card.</li><li>Watch the quiet ones. Ask someone who hasn't spoken to explain the plan back.</li></ul></div>
    <div><h2 class="rule">Don't</h2><ul style="margin-top:2mm"><li>Write any part of the plan or the board.</li><li>Visit tables outside your route. Every table gets equal time.</li><li>Give them the answer from the judges' notes.</li><li>Stay past 11:40. The critique has to come from the participants.</li></ul></div></div>
  <h2 class="rule">Questions that work</h2><ul style="margin-top:2mm"><li>If the person at the centre of this left tomorrow, which step breaks first?</li><li>Where is that written down, and who keeps it current?</li><li>Who is the backup for that owner?</li><li>How will you know in 30 days that it's working?</li><li>Is that on the card, or have you assumed it?</li></ul>
  <h2 class="rule">${n === 6 ? "The six tasks" : n === 1 ? "The task" : "The tasks"} in one line each</h2><ul style="margin-top:2mm">${
    ctx.inUse.map((t) => `<li><b>${e(t.code)} · ${e(t.title)}:</b> ${e(t.vulnerability)}</li>`).join("")}</ul>`;
  return page(site, "Mentor guide", "QLV 2026 · Day two", body);
}

export function routeCard(site, mentor) {
  const body = `<div class="kick">Route card</div><h1>${e(mentor.name)}</h1>
  <p>Your tables: <b>${e(mentor.tables.map((t) => t.name).join(" and ") || "Not set yet")}</b>. Ten minutes at each in turn, from 10:50am. Leave the floor at 11:40am.</p>
  <h2 class="rule">Your route</h2><table class="t"><thead><tr><th style="width:18%">Time</th><th style="width:28%">Table</th><th>Their task</th></tr></thead><tbody>${
    mentor.route.map((r) => { const t = mentor.tables.find((x) => x.name === r.table)?.task; return `<tr><td class="b">${e(r.time)}</td><td class="b">${e(r.table)}</td><td>${t ? `${e(t.code)} · ${e(t.title)}` : ""}</td></tr>`; }).join("")}</tbody></table>
  <h2 class="rule">At each table</h2><ul style="margin-top:2mm"><li>Read the task card on the table before you speak.</li><li>Ask one question that makes them check their plan against the test.</li><li>Move on when the ten minutes are up, even mid-conversation.</li></ul>`;
  return page(site, "Route card", "QLV 2026 · Day two", body);
}

// ---------- the page around a pack ----------

export function packDocument(title, pagesHtml, { warn = "", pages = 0 } = {}) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>QLV 2026 · ${e(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Poppins:wght@600;700;800&family=Source+Sans+3:wght@400;600;700&display=swap">
<style>${CSS}</style></head><body>
<div class="bar"><b>${e(title)}${pages ? ` · ${pages} pages` : ""}</b><button onclick="print()">Print or save as PDF</button>${warn ? `<span class="warn">${e(warn)}</span>` : ""}<span>In the print window choose "Save as PDF" for a file. Set margins to none and turn on background graphics.</span></div>
${pagesHtml}</body></html>`;
}
export const countPages = (html) => (html.match(/<section class="page/g) || []).length;
