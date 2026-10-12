// Private dashboard for the research survey. The page holds no data: it asks the
// Worker for counts using the export key, sent as a header rather than in the link.

import { ENDPOINT } from "../config.js";

const API = ENDPOINT.replace(/\/api\/submit$/, "");
const STORE = "sw-dashboard-key";
const app = document.getElementById("app");
const lockForm = document.getElementById("lock");
const actions = document.getElementById("actions");
const updated = document.getElementById("updated");
const tip = document.getElementById("tip");
let key = "";
let timer = null;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (n, of) => (of ? Math.round((n / of) * 100) : 0);
const when = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dayLabel = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function readKey() {
  try { return localStorage.getItem(STORE) || sessionStorage.getItem(STORE) || ""; } catch { return ""; }
}
function keepKey(k, remember) {
  try {
    sessionStorage.setItem(STORE, k);
    if (remember) localStorage.setItem(STORE, k); else localStorage.removeItem(STORE);
  } catch { /* storage blocked: the key lasts until the page closes */ }
}
function forgetKey() {
  try { localStorage.removeItem(STORE); sessionStorage.removeItem(STORE); } catch { /* nothing stored */ }
}

async function call(path) {
  const res = await fetch(API + path, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
  if (res.status === 404) throw Object.assign(new Error("bad key"), { badKey: true });
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res;
}

async function load() {
  updated.textContent = "Loading…";
  try {
    const data = await (await call("/api/stats")).json();
    render(data);
    actions.hidden = false;
    updated.textContent = `Updated ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. Refreshes every 2 minutes while this page is open.`;
  } catch (e) {
    if (e.badKey) { lock("That key was not accepted. Check it matches the EXPORT_KEY secret exactly."); return; }
    updated.textContent = "Could not reach the server. Check your connection and press Refresh.";
  }
}

function lock(message) {
  clearInterval(timer);
  key = "";
  forgetKey();
  actions.hidden = true;
  updated.textContent = "";
  app.replaceChildren(lockForm);
  const err = document.getElementById("lock-error");
  err.textContent = message || "";
  err.hidden = !message;
  document.getElementById("key").value = "";
}

function start(k) {
  key = k;
  load();
  clearInterval(timer);
  timer = setInterval(() => { if (!document.hidden) load(); }, 120000);
}

// ---------- rendering ----------

function bars(items, of) {
  return `<ul class="bars">${items.map((o) => `
    <li class="bar-row">
      <div class="bar-text"><span>${esc(o.label)}</span><span class="bar-num">${o.count} <em>${pct(o.count, of)}%</em></span></div>
      <div class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${pct(o.count, of)}%"></span></div>
    </li>`).join("")}</ul>`;
}

function daysChart(days) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const peak = days.reduce((a, d, i) => (d.count > days[a].count ? i : a), 0);
  const cols = days.map((d, i) => {
    const label = `${dayLabel(d.date)}: ${d.count} response${d.count === 1 ? "" : "s"}`;
    const showNum = d.count > 0 && (i === peak || i === days.length - 1);
    const h = (d.count / max) * 100;
    return `<div class="col" tabindex="0" data-tip="${esc(label)}" aria-label="${esc(label)}">${showNum ? `<b style="bottom:calc(${h}% + 4px)">${d.count}</b>` : ""}<span style="height:${h}%"></span></div>`;
  }).join("");
  const table = days.filter((d) => d.count).reverse().map((d) => `<tr><td>${dayLabel(d.date)}</td><td>${d.count}</td></tr>`).join("");
  return `
    <div class="cols">${cols}</div>
    <div class="col-axis"><span>${dayLabel(days[0].date)}</span><span>Today</span></div>
    <details class="table-toggle"><summary>Show as a table</summary>
      ${table ? `<table class="dash-table"><thead><tr><th>Day</th><th>Responses</th></tr></thead><tbody>${table}</tbody></table>` : '<p class="empty">No responses in the last 30 days.</p>'}
    </details>`;
}

function questionBlock(q) {
  const head = `<h3>${esc(q.label)}</h3>`;
  if (!q.options) {
    return `<div class="q-block">${head}<p class="sub">${q.answered} written answer${q.answered === 1 ? "" : "s"}. Read them in the answers CSV.</p></div>`;
  }
  const note = q.type === "multi" ? (q.max ? `People could choose up to ${q.max}, so percentages add up to more than 100%.` : "People could choose more than one, so percentages add up to more than 100%.") : "";
  return `<div class="q-block">${head}<p class="sub">${q.answered} answered. ${note}</p>${q.answered ? bars(q.options, q.answered) : ""}</div>`;
}

function render(d) {
  const c = d.contacts || { total: 0, results: 0, interview: 0 };
  const sections = d.sections.map((s) => {
    const n = Math.max(0, ...s.questions.map((q) => q.answered));
    return `
      <details class="section-block">
        <summary><span>${esc(s.title)}</span><span class="section-count">${n} response${n === 1 ? "" : "s"}</span></summary>
        <div class="section-inner">${n ? s.questions.map(questionBlock).join("") : '<p class="empty">No answers in this section yet.</p>'}</div>
      </details>`;
  }).join("");

  const recent = d.recent.length
    ? `<table class="dash-table"><thead><tr><th>Reference</th><th>Submitted (Lagos)</th><th>Type</th></tr></thead><tbody>${d.recent.map((r) => `<tr><td class="ref">${esc(r.ref)}</td><td>${when(r.at)}</td><td>${esc(r.role)}</td></tr>`).join("")}</tbody></table>`
    : '<p class="empty">No responses yet.</p>';

  app.innerHTML = `
    <div class="dash-grid">
      <div class="tiles">
        <div class="tile"><p class="tile-label">Total responses</p><p class="tile-value">${d.total}</p></div>
        <div class="tile"><p class="tile-label">Today</p><p class="tile-value">${d.today}</p></div>
        <div class="tile"><p class="tile-label">Last 7 days</p><p class="tile-value">${d.last7}</p></div>
        <div class="tile"><p class="tile-label">Latest response</p><p class="tile-value small">${d.lastAt ? ago(d.lastAt) : "None yet"}</p></div>
      </div>

      <div class="card">
        <h2>Responses per day</h2>
        <p class="sub">Last 30 days, Lagos time.</p>
        ${daysChart(d.days)}
      </div>

      <div class="dash-grid dash-two">
        <div class="card">
          <h2>Who responded</h2>
          <p class="sub">By the answer to the first question.</p>
          ${bars(d.roles, d.total)}
        </div>
        <div class="card">
          <h2>Contact details</h2>
          <p class="sub">${c.total} of ${d.total} respondents left details. Names and emails are only in the contacts CSV.</p>
          ${bars([{ label: "Want a summary of the findings", count: c.results }, { label: "Open to a follow-up interview", count: c.interview }], d.total)}
          <div class="downloads">
            <button class="btn btn-ink" type="button" data-dl="responses">Download answers CSV</button>
            <button class="btn btn-ink" type="button" data-dl="contacts">Download contacts CSV</button>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Latest responses</h2>
        <p class="sub">The 10 most recent. Quote a reference to delete a response.</p>
        ${recent}
      </div>

      ${sections}
    </div>`;

  app.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => download(b)));
}

async function download(btn) {
  const kind = btn.dataset.dl;
  const text = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Preparing…";
  try {
    const blob = await (await call(`/api/export/${kind}.csv`)).blob();
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `research-${kind}-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  } catch (e) {
    if (e.badKey) { lock("That key is no longer accepted. Enter it again."); return; }
    updated.textContent = "The download failed. Please try again.";
  }
  btn.disabled = false;
  btn.textContent = text;
}

// ---------- tooltip for the daily columns ----------

function showTip(el) {
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const w = tip.offsetWidth;
  tip.style.left = `${Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
}
const hideTip = () => { tip.hidden = true; };
app.addEventListener("mouseover", (e) => { const el = e.target.closest("[data-tip]"); if (el) showTip(el); else hideTip(); });
app.addEventListener("mouseleave", hideTip);
app.addEventListener("focusin", (e) => { const el = e.target.closest("[data-tip]"); if (el) showTip(el); else hideTip(); });
app.addEventListener("focusout", hideTip);
window.addEventListener("scroll", hideTip, { passive: true });

// ---------- start ----------

lockForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const k = document.getElementById("key").value.trim();
  if (!k) return;
  keepKey(k, document.getElementById("remember").checked);
  start(k);
});
document.getElementById("refresh").addEventListener("click", load);
document.getElementById("signout").addEventListener("click", () => lock());

const saved = readKey();
if (saved) start(saved);
