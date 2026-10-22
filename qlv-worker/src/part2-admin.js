// Admin routes for part 2: settings and sign-ins, rebalance, check-in,
// briefings, scoring and the stage. admin.js checks the session and role,
// then hands the call here.

import { HttpError, now } from "./index.js";
import { tableName } from "./config.js";
import * as ops from "./admin-ops.js";
import { getSettings, saveSettings, isFrozen } from "./settings.js";
import { rebalanceState, rebalanceView, applyRebalance, dismissRebalance, announceTeams } from "./rebalance.js";
import { checkinView, markArrival, arrivalsByTable } from "./checkin.js";
import * as brief from "./briefings.js";
import { tallyView, unlockScore } from "./scoring.js";
import { stageView, stageAction, displayLink } from "./stage.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------- settings and sign-ins ----------

async function settingsView(env) {
  const [s, access, staff] = await Promise.all([
    getSettings(env),
    env.DB.prepare("SELECT email, role, added_at, added_by FROM access ORDER BY role, email").all().then((r) => r.results),
    brief.staffPeople(env),
  ]);
  return { settings: s, frozen: isFrozen(s), access, judges: staff.filter((p) => p.judge && p.kind !== "facilitator").map((p) => ({ id: p.id, name: p.name })) };
}

async function saveAccess(env, b, who, admins) {
  const email = String(b.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "That email does not look complete.");
  if (b.remove) {
    await env.DB.prepare("DELETE FROM access WHERE email = ?").bind(email).run();
  } else {
    if (!["desk", "stage"].includes(b.role)) throw new HttpError(400, "Choose the desk or the stage.");
    if (admins.includes(email)) throw new HttpError(409, "That address already signs in as admin or treasurer.");
    await env.DB.prepare(`INSERT INTO access (email, role, added_at, added_by) VALUES (?, ?, ?, ?)
      ON CONFLICT (email) DO UPDATE SET role = excluded.role, added_at = excluded.added_at, added_by = excluded.added_by`).bind(email, b.role, now(), who).run();
  }
  return settingsView(env);
}

// ---------- tables, with the part 2 flags ----------

async function tablesPlus(env) {
  // Seat anyone due first (tablesView does), then read the flags, so a late
  // addition seated by this very call is listed straight away.
  const view = await ops.tablesView(env);
  const [rb, arrivals, late] = await Promise.all([
    rebalanceState(env), arrivalsByTable(env),
    env.DB.prepare("SELECT name, table_index FROM tickets WHERE late_after_freeze = 1 AND cancelled_at IS NULL AND table_index IS NOT NULL ORDER BY seated_at DESC").all().then((r) => r.results),
  ]);
  const flags = [...view.flags];
  if (rb.flag) {
    const c = {};
    for (const r of rb.rows) c[r.table_index] = (c[r.table_index] || 0) + 1;
    for (const t of rb.short) flags.unshift({ kind: "short", link: "rebalance", title: `${tableName(t)} has ${c[t]} ${c[t] === 1 ? "person" : "people"}`, text: `That is below the minimum of ${rb.s.min_table_size}. Rebalance before the teams are announced.` });
  }
  for (const l of late) flags.push({ kind: "late", title: `Late addition: ${l.name} at ${tableName(l.table_index)}`, text: "Seated after the teams were announced. Tell the team directly." });
  return {
    ...view, flags,
    tables: view.tables.map((t) => ({ ...t, arrived: arrivals ? arrivals[t.index] || 0 : null })),
    frozen: rb.frozen, rebalanceOpen: rb.closed && !rb.frozen,
  };
}

// ---------- printed table sheets ----------

const SHEET_CSS = `
@page{size:A4;margin:0}
*{box-sizing:border-box}body{margin:0;font-family:'Source Sans 3',Arial,sans-serif;color:#0E1B33;background:#E3EBF4}
.page{width:210mm;min-height:297mm;margin:10mm auto;background:#fff;display:flex;flex-direction:column;page-break-after:always;break-after:page}
.band{background:#0F2B63;color:#fff;padding:7mm 12mm;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.band .logos{display:flex;align-items:center;gap:10px}.band img.jci{height:11mm}.band img.qlv{height:11mm}.band .rule{width:1px;height:10mm;background:rgba(255,255,255,.45)}
.band .r{text-align:right;font-family:Poppins,Arial,sans-serif;font-size:9pt;line-height:1.4}.band .r b{display:block;font-size:10pt}
.head{display:flex;justify-content:space-between;align-items:flex-start;padding:7mm 12mm 0;gap:8mm}
.head .kind{font-family:'IBM Plex Mono',monospace;font-size:9pt;letter-spacing:.12em;text-transform:uppercase;color:#1F7D87;padding-top:3mm}
.head .table{font-family:Poppins,Arial,sans-serif;font-weight:800;font-size:30pt;color:#0F2B63;line-height:1}
.body{padding:5mm 12mm 0;flex:1;font-size:10.5pt;line-height:1.45}
.body h2.doc-title{font-family:Poppins,Arial,sans-serif;font-size:15pt;color:#0F2B63;margin:0 0 4mm}
.body h3{font-family:Poppins,Arial,sans-serif;font-size:11pt;color:#0F2B63;margin:5mm 0 1.5mm}
.body p{margin:0 0 2.5mm}.body ul{margin:0 0 3mm;padding-left:5mm}
.box{border:1.2px solid #0F2B63;border-radius:2mm;padding:2.5mm 3.5mm;margin:0 0 3mm;break-inside:avoid}
.box h4{margin:0 0 1.5mm;font-family:Poppins,Arial,sans-serif;font-size:10.5pt;color:#0F2B63}
.box .space{height:30mm}
.box ol.lines{margin:0;padding-left:6mm}.box ol.lines li{border-bottom:1px solid #9AA8BD;height:7.5mm}
.box table.owners{width:100%;border-collapse:collapse}.box table.owners th{text-align:left;font-size:9pt;color:#4A5B75;padding:1mm 0}
.box table.owners td{border-bottom:1px solid #9AA8BD;height:7.5mm}.box table.owners td:first-child{width:68%}
.box.crit .row{display:flex;gap:3mm;border-top:1px solid #C6D0DE;padding:1.5mm 0}.box.crit .row b{width:20mm;font-size:9pt;color:#1F7D87}.box.crit .row span{flex:1;height:9mm}
table.doc{border-collapse:collapse;width:100%;margin:0 0 3mm;font-size:9.5pt}table.doc th,table.doc td{border-bottom:1px solid #C6D0DE;padding:1.5mm;text-align:left;vertical-align:top}
.foot{display:flex;justify-content:space-between;padding:4mm 12mm 6mm;font-size:8.5pt;color:#4A5B75;border-top:1px solid #E3EBF4;margin-top:4mm}
.foot .ref{font-family:'IBM Plex Mono',monospace}
.bar{position:sticky;top:0;background:#0F2B63;color:#fff;padding:10px 16px;font-family:Arial,sans-serif;font-size:13px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;z-index:2}
.bar button{font:inherit;font-weight:700;padding:8px 14px;border:0;border-radius:6px;background:#EFC22D;color:#0F2B63;cursor:pointer}
.bar .warn{background:#F5E6E1;color:#8A2A20;padding:4px 8px;border-radius:5px}
@media print{body{background:#fff}.page{margin:0;width:auto;min-height:297mm}.bar{display:none}}
`;

export async function sheetsPage(env, which) {
  const d = await brief.sheetsData(env, which);
  const site = env.SITE_URL;
  const e = (x) => String(x ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pages = d.tables.flatMap((t) => t.pages.map((pg) => `<section class="page">
  <div class="band"><div class="logos"><img class="jci" src="${site}assets/jci-aso-white.png" alt="JCI Aso"><span class="rule"></span><img class="qlv" src="${site}assets/qlv-white.png" alt="Quality Leadership Value"></div>
    <div class="r"><b>QLV 2026 · Building Systems That Outlive You</b>6 &amp; 7 November 2026</div></div>
  <div class="head"><span class="kind">${e(pg.title)}</span><span class="table">${e(t.name)}</span></div>
  <div class="body">${pg.html}</div>
  <div class="foot"><span>JCI Aso · Transcorp Hilton, Abuja</span><span class="ref">${e(t.name)} · ${e(pg.title)}</span></div>
</section>`)).join("\n");
  const title = which === "all" ? "All tables" : d.tables[0].name;
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>QLV 2026 table sheets · ${e(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Poppins:wght@600;700;800&family=Source+Sans+3:wght@400;600&display=swap">
<style>${SHEET_CSS}</style></head><body>
<div class="bar"><b>${e(title)} · ${d.tables.length * 4} A4 pages</b><button onclick="print()">Print or save as PDF</button>
${d.missing.length ? `<span class="warn">Still to fill: ${e(d.missing.join(", "))}</span>` : ""}<span>Choose "Save as PDF" in the print window for a PDF.</span></div>
${pages}</body></html>`;
}

// ---------- routes ----------

export function part2Routes(env, q, body, who, admins) {
  return {
    "GET settings": () => settingsView(env),
    "POST settings": async () => { await saveSettings(env, body.settings, who); return settingsView(env); },
    "POST access": () => saveAccess(env, body, who, admins),
    "GET tables": () => tablesPlus(env),
    "GET rebalance": () => rebalanceView(env),
    "POST rebalance": () => applyRebalance(env, body, who),
    "POST rebalance-dismiss": () => dismissRebalance(env, who),
    "POST teams-announced": () => announceTeams(env, who),
    "GET checkin": () => checkinView(env),
    "POST checkin": () => markArrival(env, body, who),
    "GET roles": () => brief.staffView(env),
    "POST role": () => brief.saveStaffRole(env, body),
    "POST auto-assign": () => brief.autoAssign(env),
    "GET tasks": () => brief.tasksView(env),
    "POST task": () => brief.saveTask(env, body, who),
    "GET templates": async () => ({ templates: await brief.templatesAll(env) }),
    "POST template": () => brief.saveTemplate(env, body, who),
    "POST template-reset": () => brief.resetTemplate(env, body),
    "GET packs": () => brief.packsView(env),
    "POST packs-generate": () => brief.generatePacks(env, body),
    "POST packs-send": () => brief.sendPacks(env, body),
    "POST pack-preview": () => brief.previewLink(env, body),
    "POST reissue": () => brief.reissueToken(env, body),
    "GET scoring": () => tallyView(env),
    "POST unlock": () => unlockScore(env, body, who),
    "GET stage": () => stageView(env),
    "POST stage": () => stageAction(env, body),
    "GET display-link": () => displayLink(env),
  };
}
