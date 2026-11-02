// The Tasks and print packs section at the top of the Tables page: which
// table has which task, the critique pairs, Assign tasks, Lock tasks, and
// the print packs with when each was last downloaded. Admin only; the board
// view never loads it. Uses the helpers in the main admin script.

export const SPRINT_STYLE = String.raw`
#spBox .sp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
#spBox select{font:inherit;border:1px solid var(--rule);border-radius:6px;padding:6px 8px;min-height:36px;max-width:100%}
#spBox .pk{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:7px 0;border-bottom:1px solid var(--line);font-size:12px}
#spBox .pk a{font-weight:600}
#spBox .chg{color:#8A2A20;font-weight:700}
#spBox .lockd{background:#E2F2F2;color:#19646D;border-radius:6px;padding:8px 10px;font-size:12px;font-weight:600;margin:0 0 10px}
`;

export const SPRINT_HTML = String.raw`<div class="card" id="spBox" style="margin:0 0 14px"></div>`;

export const SPRINT_JS = String.raw`
let spData = null;
async function loadSprint() {
  if (ROLE !== "admin") { $("#spBox").hidden = true; return; }
  const d = spData = await call("sprint");
  const locked = !!d.locked, p = d.print;
  const opt = (sel) => '<option value="">Choose a task</option>' + d.tasks.map((t) => '<option value="' + t.id + '"' + (t.id === sel ? " selected" : "") + ">" + esc(t.code + " · " + t.title) + "</option>").join("");
  const name = (i) => (d.tables.find((x) => x.table === i) || {}).name || "";
  const rows = d.tables.map((x) => "<tr><td><b>" + esc(x.name) + "</b></td><td>" + (locked ? esc(x.code ? x.code + " · " + x.title : "None") :
    '<select data-sptable="' + x.table + '" aria-label="Task for ' + esc(x.name) + '">' + opt(x.taskId) + "</select>") +
    (x.assignedBy === "admin" ? ' <span class="tiny">set by hand</span>' : "") + '</td><td class="small">Critiques ' + esc(name(x.critiquesPlanOf)) + "'s plan · critiqued by " + esc(name(x.critiquedBy)) + "</td></tr>").join("");
  const item = (it, href) => '<div class="pk"><span>' + esc(it.label) + (it.changed ? ' · <span class="chg">changed since download</span>' : it.downloadedAt ? ' <span class="tiny">· opened ' + esc(when(it.downloadedAt)) + "</span>" : "") + '</span>' +
    (locked ? '<a href="' + href + '" target="_blank" rel="noopener">Open</a>' : '<span class="tiny">Lock first</span>') + "</div>";
  $("#spBox").innerHTML = '<h2>Tasks and print packs</h2>' +
    '<p class="small" style="margin:-4px 0 10px">Each table hands its plan to the next and critiques the plan of the table before it. No table should critique a plan on its own task. Only admin sees this before 7:00am on Saturday.</p>' +
    (d.clashes.length ? '<div class="miss" style="margin:0 0 10px">' + d.clashes.map((c) => esc(c.from) + " hands its plan to " + esc(c.to) + " and both have " + esc(c.code) + ". " + esc(c.to) + " would critique a plan on its own task.").join("<br>") + "</div>" : "") +
    (locked ? '<div class="lockd">Tasks locked ' + esc(when(d.locked.at)) + ". Print packs are ready.</div>" : "") +
    '<div class="sp-grid"><div><table><thead><tr><th>Table</th><th>Task</th><th>Handover</th></tr></thead><tbody>' + rows + "</tbody></table>" +
    '<div class="actions">' + (locked ? '<button class="btn ghost" data-sp="unlock">Unlock tasks</button>'
      : '<button class="btn ghost" data-sp="assign">Assign tasks</button><button class="btn' + (d.complete ? " gold" : "") + '" data-sp="lock"' + (d.complete ? "" : " disabled title=\"Give every table a task first\"") + ">Lock tasks</button>") + "</div></div>" +
    "<div><h2 style=\"font-size:14px\">Print packs</h2><p class=\"small\" style=\"margin:0 0 6px\">Each opens ready to print. Choose Save as PDF in the print window for a file.</p>" +
    item(p.all, "/admin/print/pack?kind=all") + p.tables.map((x) => item(x, "/admin/print/pack?kind=table&t=" + x.target)).join("") + item(p.spares, "/admin/print/pack?kind=spares") +
    '<h2 style="font-size:14px;margin-top:12px">Judges</h2>' + (p.judges.length ? item({ label: "All judge packs", changed: p.judges.some((j) => j.changed), downloadedAt: null }, "/admin/print/pack?kind=judges") + p.judges.map((j) => item(j, "/admin/print/pack?kind=judge&id=" + j.target)).join("") : '<p class="small">No judges yet.</p>') +
    '<h2 style="font-size:14px;margin-top:12px">Mentors</h2>' + (p.mentors.length ? item({ label: "All mentor packs", changed: p.mentors.some((m) => m.changed), downloadedAt: null }, "/admin/print/pack?kind=mentors") + p.mentors.map((m) => item(m, "/admin/print/pack?kind=mentor&id=" + m.target)).join("") : '<p class="small">No mentors yet.</p>') +
    "</div></div>";
}
document.addEventListener("change", async (e) => {
  const s = e.target.closest("[data-sptable]");
  if (!s || !s.value) return;
  try { await call("sprint-table", { table: Number(s.dataset.sptable), taskId: s.value }); await loadSprint(); if (spData.clashes.length) msg("Saved, but check the warning: a table would critique a plan on its own task."); else msg("Task changed.", true); }
  catch (err) { msg(err.message); }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-sp]");
  if (!b) return;
  const a = b.dataset.sp;
  try {
    if (a === "assign" && spData.tables.some((x) => x.taskId) && !confirm("Assign tasks automatically? This replaces the tasks already chosen for every table.")) return;
    if (a === "unlock" && !confirm("Unlock the tasks? Any packs already printed may be out of date if you change a table's task.")) return;
    await call(a === "assign" ? "sprint-assign" : "sprint-lock", a === "assign" ? {} : { lock: a === "lock" });
    await loadSprint();
    msg(a === "assign" ? (spData.clashes.length ? "Assigned, but some pairs share a task. See the warning." : "Tasks assigned. No table critiques its own task.") : a === "lock" ? "Tasks locked. The print packs are ready." : "Tasks unlocked.", a !== "assign" || !spData.clashes.length);
  } catch (err) { msg(err.message); }
});
`;
