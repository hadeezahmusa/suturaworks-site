// A judge's scoring screen. No login: the link is the key.
//
// Never lose a judge's work to venue wifi: every tap is kept on the phone,
// and a submitted score waits in an outbox on the phone until the server has
// it. The outbox retries every few seconds and whenever the phone comes back
// online. Sending the same score twice is harmless on the server.

import { API } from "./config.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const K = new URLSearchParams(location.search).get("k") || "";
const DRAFT = "qlv26-draft:" + K.slice(0, 12);
const OUTBOX = "qlv26-outbox:" + K.slice(0, 12);
let data = null, current = null, sending = false;

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: keep going in memory */ } },
};
let drafts = store.get(DRAFT, {});
let outbox = store.get(OUTBOX, []);

function hintFor(c, v) {
  if (!v) return "Tap a score. 1, 3 and 5 are described; 2 and 4 sit between.";
  if (v === 2) return "2: between “" + c.anchors[1] + "” and “" + c.anchors[3] + "”";
  if (v === 4) return "4: between “" + c.anchors[3] + "” and “" + c.anchors[5] + "”";
  return v + ": " + c.anchors[v];
}

async function load() {
  try {
    const res = await fetch(API + "/api/score?k=" + encodeURIComponent(K));
    const d = await res.json();
    if (!res.ok) { $("#main").innerHTML = '<div class="err">' + esc(d.error || "This link could not be opened.") + "</div>"; return; }
    data = d;
  } catch {
    if (!data) { $("#main").innerHTML = '<div class="err">No connection yet. This page keeps trying.</div>'; return; }
  }
  $("#ref").textContent = data.judge.ref;
  $("#who").textContent = data.judge.name + " · " + data.judge.code;
  if (data.closed) { $("#title").textContent = "Scoring"; $("#main").innerHTML = '<div class="card info">' + esc(data.closed) + "</div>"; $("#bar").hidden = true; return; }
  // Scores waiting in the outbox count as submitted here, so the judge sees them locked.
  for (const o of outbox) { const t = data.teams.find((x) => x.table === o.table); if (t && t.state !== "submitted") { t.state = "submitted"; t.values = o.values; t.pending = true; } }
  if (current === null || !data.teams.some((t) => t.table === current && t.state !== "advised")) {
    const pick = data.teams.find((t) => t.onStage && t.state !== "advised") || data.teams.find((t) => t.state === "open") || data.teams.find((t) => t.state === "submitted");
    current = pick ? pick.table : null;
  }
  draw();
}

function draw() {
  $("#chips").innerHTML = data.teams.map((t) => {
    const cls = t.state === "advised" ? "advised" : t.state === "waiting" ? "waiting" : "";
    return '<button type="button" class="chip ' + cls + (t.table === current ? " on" : "") + (t.state === "submitted" ? " done" : "") + '" data-team="' + t.table + '"' + (t.state === "advised" ? ' disabled aria-disabled="true"' : "") + ">" + esc(t.name) + (t.state === "advised" ? " · advised" : "") + "</button>";
  }).join("");
  const t = data.teams.find((x) => x.table === current);
  if (!t) {
    $("#title").textContent = "Waiting for the first team";
    $("#main").innerHTML = '<div class="card info">Teams open here as they go on stage. Keep this page open.</div>';
    $("#bar").hidden = true;
    return;
  }
  $("#title").textContent = "Scoring " + t.name;
  if (t.state === "waiting") {
    $("#main").innerHTML = '<div class="card info">' + esc(t.name) + " presents at " + esc(t.time) + ". You can score it once it has been on stage.</div>";
    $("#bar").hidden = true;
    return;
  }
  const locked = t.state === "submitted";
  const vals = locked ? t.values : (drafts[t.table] || [null, null, null, null, null]);
  const net = outbox.length ? '<div class="net wait">' + (outbox.length === 1 ? "One score is" : outbox.length + " scores are") + " saved on this phone and will send when the connection returns. You can carry on.</div>"
    : locked ? '<div class="net ok">Submitted and locked. If it needs changing, speak to the lead facilitator.</div>' : "";
  $("#main").innerHTML = net + data.criteria.map((c, i) => '<fieldset><legend>' + esc(c.name) + '</legend><span class="crit">' + esc(c.name) + '</span><div class="opts">' +
    [1, 2, 3, 4, 5].map((n) => '<button type="button" data-c="' + i + '" data-n="' + n + '" aria-label="' + esc(c.name) + ", score " + n + '" aria-pressed="' + (vals[i] === n) + '"' + (locked ? " disabled" : "") + ">" + n + "</button>").join("") +
    '</div><p class="hint">' + esc(hintFor(c, vals[i])) + "</p></fieldset>").join("");
  const total = vals.reduce((a, v) => a + (v || 0), 0), left = vals.filter((v) => !v).length;
  $("#bar").hidden = false;
  $("#total").textContent = total;
  const b = $("#submit");
  b.disabled = locked || left > 0;
  b.className = "submit" + (locked ? " locked" : left ? "" : " ready");
  b.textContent = locked ? (t.pending ? "Saved · sending" : "Submitted · locked") : left ? left + " still to score" : "Submit score";
}

async function flush() {
  if (sending || !outbox.length) return;
  sending = true;
  try {
    while (outbox.length) {
      const o = outbox[0];
      let res;
      try { res = await fetch(API + "/api/score", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ k: K, table: o.table, values: o.values }) }); }
      catch { break; } // offline: try again later
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        // Accepted, or refused for good (already locked with other values): either way stop retrying it.
        if (!res.ok) { const d = await res.json().catch(() => ({})); alert((d.error || "This score could not be saved.") + " Please speak to the lead facilitator."); }
        outbox.shift(); store.set(OUTBOX, outbox);
      } else break;
    }
  } finally { sending = false; }
  if (data) load();
}

document.addEventListener("click", (e) => {
  const team = e.target.closest("[data-team]");
  if (team && !team.disabled) { current = Number(team.dataset.team); draw(); return; }
  const opt = e.target.closest("[data-c]");
  if (opt && !opt.disabled) {
    const v = drafts[current] || [null, null, null, null, null];
    v[Number(opt.dataset.c)] = Number(opt.dataset.n);
    drafts[current] = v; store.set(DRAFT, drafts); draw(); return;
  }
  if (e.target.closest("#submit")) {
    const v = drafts[current];
    if (!v || v.some((x) => !x)) return;
    const t = data.teams.find((x) => x.table === current);
    if (!confirm("Submit " + v.reduce((a, x) => a + x, 0) + " out of 25 for " + t.name + "? It locks once submitted.")) return;
    outbox.push({ table: current, values: v }); store.set(OUTBOX, outbox);
    delete drafts[current]; store.set(DRAFT, drafts);
    t.state = "submitted"; t.values = v; t.pending = true;
    draw(); flush();
  }
});
addEventListener("online", flush);
setInterval(flush, 5000);
setInterval(() => { if (!document.hidden && !sending) load(); }, 15000);
load().then(flush);
