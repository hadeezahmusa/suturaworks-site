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
