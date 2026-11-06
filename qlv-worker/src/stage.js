// The Stage tab and the projector display (part 2, feature 5). One shared
// state row; the control page changes it and the display follows it within a
// second. The clock is stored as when it ends (or how much was left when
// paused), never counted down locally, so control and display always agree.
//
// The display shows no personal data: table names and times only, never a
// participant's name, never a score below the top three, nothing from payments.

import { HttpError, now } from "./index.js";
import { tableName } from "./config.js";
import { getSettings } from "./settings.js";

export const PHASES = ["arrival", "sprint", "handover", "critique", "response", "lunch", "presentations", "results"];
export const PHASE_LABEL = { arrival: "Arrival", sprint: "Sprint", handover: "Handover", critique: "Critique", response: "Response", lunch: "Lunch", presentations: "Presentations", results: "Results" };
const HANDOVER_MINUTES = 5;

// Who can be put on screen while they speak, with the logo of who they
// represent (a row on the On screen tab).
export const SPEAKERS = [
  { id: "eha", eyebrow: "Keynote", name: "Abdulkareem Iyamu", role: "Chief Commercial Officer, EHA Clinics", source: "partner", ref: "6" },
  { id: "miva", eyebrow: "Lead sponsor remarks", name: "MIVA Open University", role: "", source: "sponsor", ref: "QLV26-017" },
  { id: "dm", eyebrow: "Lead sponsor remarks", name: "Dikko & Mahmoud Solicitors and Advocates", role: "", source: "partner", ref: "4" },
];
const JUDGES_KEY = "stage:judges-photo";
const MAX_PHOTO = 4 * 1024 * 1024;

const BLANK = {
  phase: "arrival",
  clock: { endsAt: null, pausedMs: null, totalMs: 0 },
  onStage: null,          // table index presenting now
  presented: [],          // tables that have finished presenting
  toggles: { partners: true, schedule: true, animation: false, music: true },
  revealed: false,
  revealStep: 0,          // places shown so far, one press each: third, then second, then the winner
  speaker: null,          // a SPEAKERS id while someone is speaking; cleared at each phase change
  testSound: 0,           // bumped by "Play a test sound"; the display plays a chime when it changes
  flash: 0,               // bumped at each phase start so the display can mark it
  version: 0,
};

export async function readStage(env) {
  const row = await env.DB.prepare("SELECT state FROM stage_state WHERE id = 1").first();
  if (!row) return structuredClone(BLANK);
  try { return { ...structuredClone(BLANK), ...JSON.parse(row.state) }; } catch { return structuredClone(BLANK); }
}

async function writeStage(env, st) {
  st.version = (st.version || 0) + 1;
  await env.DB.prepare(`INSERT INTO stage_state (id, state, updated_at) VALUES (1, ?, ?)
    ON CONFLICT (id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`).bind(JSON.stringify(st), now()).run();
  return st;
}

function minutesFor(phase, s) {
  return { sprint: s.sprint_minutes, handover: HANDOVER_MINUTES, critique: s.critique_minutes, response: s.response_minutes, presentations: s.presentation_minutes }[phase] || 0;
}

function startClock(st, minutes) {
  const ms = minutes * 60000;
  st.clock = ms ? { endsAt: Date.now() + ms, pausedMs: null, totalMs: ms } : { endsAt: null, pausedMs: null, totalMs: 0 };
}

export function remainingMs(clock, at = Date.now()) {
  if (clock.pausedMs !== null && clock.pausedMs !== undefined) return clock.pausedMs;
  if (!clock.endsAt) return null;
  return Math.max(0, clock.endsAt - at);
}

// Tables in presenting order. Imported lazily to keep the module graph simple.
async function order(env) {
  const { tablesNow } = await import("./briefings.js");
  return tablesNow(env);
}

function enterPhase(st, phase, s, tables) {
  st.phase = phase;
  st.speaker = null;
  st.flash = (st.flash || 0) + 1;
  if (phase === "presentations") {
    if (st.onStage === null || st.onStage === undefined) st.onStage = tables.find((t) => !st.presented.includes(t)) ?? null;
    startClock(st, st.onStage === null ? 0 : s.presentation_minutes);
  } else {
    if (st.onStage !== null && st.onStage !== undefined && !st.presented.includes(st.onStage)) st.presented.push(st.onStage);
    st.onStage = null;
    startClock(st, minutesFor(phase, s));
  }
}

export async function stageAction(env, b) {
  const [st, s, tables] = await Promise.all([readStage(env), getSettings(env), order(env)]);
  const a = b.action;
  if (a === "phase") {
    if (!PHASES.includes(b.phase)) throw new HttpError(400, "Choose a stage of the day.");
    enterPhase(st, b.phase, s, tables);
  } else if (a === "pause") {
    if (st.clock.endsAt) { st.clock.pausedMs = Math.max(0, st.clock.endsAt - Date.now()); st.clock.endsAt = null; }
  } else if (a === "resume") {
    if (st.clock.pausedMs !== null) { st.clock.endsAt = Date.now() + st.clock.pausedMs; st.clock.pausedMs = null; }
  } else if (a === "addMinute") {
    if (st.clock.pausedMs !== null) st.clock.pausedMs += 60000;
    else if (st.clock.endsAt) st.clock.endsAt = Math.max(st.clock.endsAt, Date.now()) + 60000;
    else return stageView(env);
    st.clock.totalMs += 60000;
  } else if (a === "next") {
    if (st.phase === "presentations") {
      if (st.onStage !== null && !st.presented.includes(st.onStage)) st.presented.push(st.onStage);
      const nextTeam = tables.find((t) => !st.presented.includes(t));
      if (nextTeam === undefined) { st.onStage = null; enterPhase(st, "results", s, tables); }
      else { st.onStage = nextTeam; st.flash++; startClock(st, s.presentation_minutes); }
    } else {
      const i = PHASES.indexOf(st.phase);
      if (i < PHASES.length - 1) enterPhase(st, PHASES[i + 1], s, tables);
    }
  } else if (a === "toggles") {
    for (const k of ["partners", "schedule", "animation", "music"]) if (k in (b.toggles || {})) st.toggles[k] = !!b.toggles[k];
  } else if (a === "speaker") {
    if (b.speaker !== null && !SPEAKERS.some((x) => x.id === b.speaker)) throw new HttpError(400, "Choose who is speaking.");
    st.speaker = b.speaker;
  } else if (a === "testSound") {
    st.testSound = (st.testSound || 0) + 1;
  } else if (a === "reveal") {
    const { computeTally } = await import("./scoring.js");
    const t = await computeTally(env);
    if (!t.allComplete) throw new HttpError(409, "Every team needs its full set of scores before the results can be shown.");
    const places = Math.min(3, t.order.length);
    if (!st.revealed) { st.revealed = true; st.revealStep = 1; }
    else st.revealStep = Math.min(places, (st.revealStep || places) + 1);
    if (st.phase !== "results") enterPhase(st, "results", s, tables);
  } else if (a === "hideResults") {
    st.revealed = false;
    st.revealStep = 0;
  } else {
    throw new HttpError(400, "That is not a stage action.");
  }
  await writeStage(env, st);
  return stageView(env);
}

// After a rehearsal: back to Arrival with nobody presented and results
// hidden. The display settings stay as they are. Refused once any score has
// been submitted, so it can never clear the real day.
export async function resetStage(env) {
  const scored = await env.DB.prepare("SELECT count(*) AS n FROM scores").first();
  if (scored?.n) throw new HttpError(409, "Judges have already submitted scores, so the stage can't be reset. Speak to the chair.");
  const st = await readStage(env);
  const fresh = { ...structuredClone(BLANK), toggles: st.toggles, version: st.version, flash: (st.flash || 0) + 1 };
  await writeStage(env, fresh);
  return stageView(env);
}

// The next step the primary button takes, in words.
function nextLabel(st, tables) {
  if (st.phase === "presentations") {
    const remaining = tables.filter((t) => !st.presented.includes(t) && t !== st.onStage);
    return remaining.length ? `Next team: ${tableName(remaining[0])}` : "Finish presentations";
  }
  return { arrival: "Start the sprint", sprint: "Lock and hand over", handover: "Open the critique", critique: "Return the critiques", response: "Start lunch", lunch: "Start presentations", results: null }[st.phase];
}

// Places on show: one more with each press of Reveal, lowest first. Only the
// places already announced ever leave the server, so the winner can't be
// read from the display page before it is shown. Older state without a step
// shows all three.
const revealStepOf = (st) => (st.revealed ? st.revealStep || 3 : 0);
function podiumSoFar(t, st) {
  const all = t.order.slice(0, 3).map((r, i) => ({ place: ["First", "Second", "Third"][i], name: r.name, avg: r.avgText }));
  return all.slice(Math.max(0, all.length - revealStepOf(st)));
}

// What the display needs: public data only.
export async function displayData(env, st) {
  const [s, tables] = await Promise.all([getSettings(env), order(env)]);
  const { presentationOrder, chainOf } = await import("./briefings.js");
  const pres = presentationOrder(tables, s);
  const { screenSponsors } = await import("./logos.js");
  const sponsors = await screenSponsors(env);
  const out = {
    phases: PHASES.map((p) => ({ id: p, label: PHASE_LABEL[p] })),
    schedule: s.schedule,
    order: pres.map((o) => ({ name: o.name, time: o.time, done: st.presented.includes(o.index), now: st.onStage === o.index })),
    chain: chainOf(tables).map((c) => tableName(c.from)).concat(tables.length ? [tableName(tables[0])] : []),
    // Partners, named sponsors and members' businesses, biggest first.
    sponsors,
    partners: sponsors.map((x) => x.name),
    speakers: await speakerList(env),
    judgesPhoto: await judgesPhotoPath(env),
    sprintCues: { half: Math.round(s.sprint_minutes / 2) },
    onStage: st.onStage === null || st.onStage === undefined ? null : tableName(st.onStage),
    upNext: null, lastScores: null, podium: null,
  };
  if (st.phase === "presentations" || st.phase === "results") {
    const later = tables.filter((t) => !st.presented.includes(t) && t !== st.onStage);
    out.upNext = later.length ? tableName(later[0]) : null;
    const prev = st.presented.at(-1);
    if (prev !== undefined) {
      const { computeTally } = await import("./scoring.js");
      const t = await computeTally(env);
      const row = t.rows.find((r) => r.index === prev);
      if (row) out.lastScores = { name: row.name, n: row.scored, of: row.expected };
      if (st.revealed) out.podium = podiumSoFar(t, st);
    } else if (st.revealed) {
      const { computeTally } = await import("./scoring.js");
      out.podium = podiumSoFar(await computeTally(env), st);
    }
  }
  return out;
}

export async function stageView(env) {
  const [st, s, tables, seen] = await Promise.all([readStage(env), getSettings(env), order(env), displaySeen(env)]);
  const { presentationOrder } = await import("./briefings.js");
  const { computeTally } = await import("./scoring.js");
  const tally = await computeTally(env);
  const connected = seen && Date.now() - seen.at < 45000;
  return {
    state: st, serverNow: Date.now(), remainingMs: remainingMs(st.clock),
    phases: PHASES.map((p) => ({ id: p, label: PHASE_LABEL[p], done: PHASES.indexOf(p) < PHASES.indexOf(st.phase), on: p === st.phase })),
    nextLabel: nextLabel(st, tables),
    queue: presentationOrder(tables, s).map((o) => ({ name: o.name, time: o.time, state: st.presented.includes(o.index) ? "Done" : st.onStage === o.index ? "On stage" : "" })),
    display: connected ? { connected: true, sound: !!seen.sound } : { connected: false },
    scored: { complete: tally.rows.filter((r) => r.complete).length, teams: tally.rows.length, all: tally.allComplete },
    speakers: (await speakerList(env)).map((x) => ({ id: x.id, label: x.eyebrow + ": " + x.name, logo: !!x.logo })),
    judgesPhoto: await judgesPhotoPath(env),
    settings: { sprint: s.sprint_minutes, critique: s.critique_minutes, response: s.response_minutes, presentation: s.presentation_minutes },
  };
}

// The display's heartbeat, kept in the settings table under its own key
// (getSettings ignores it). Written at most every 20 seconds: a ten-hour day
// is under 2,000 writes, well inside D1's free allowance.
async function displaySeen(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'stage_display'").first();
  try { return row ? JSON.parse(row.value) : null; } catch { return null; }
}

// The display's own link, polled every second.
export async function displayPoll(env, url) {
  const { tokenRow } = await import("./briefings.js");
  const t = await tokenRow(env, url.searchParams.get("k"), "display");
  if (!t) throw new HttpError(404, "This display link is not valid. Open the display again from the Stage tab.");
  const st = await readStage(env);
  const seen = await displaySeen(env);
  const sound = url.searchParams.get("sound") === "1";
  if (!seen || Date.now() - seen.at > 20000 || !!seen.sound !== sound) {
    await env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('stage_display', ?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(JSON.stringify({ at: Date.now(), sound }), now()).run();
  }
  const since = Number(url.searchParams.get("v") || -1);
  // Unchanged state: send only the clock, which is cheap and keeps the display honest.
  const base = { version: st.version, serverNow: Date.now(), phase: st.phase, clock: st.clock, remainingMs: remainingMs(st.clock), testSound: st.testSound, flash: st.flash, toggles: st.toggles, revealed: st.revealed, revealStep: revealStepOf(st), speaker: st.speaker || null };
  if (since === st.version) return base;
  return { ...base, data: await displayData(env, st) };
}

export async function displayLink(env) {
  const { ensureToken, linkFor } = await import("./briefings.js");
  return { url: linkFor(env, "display", await ensureToken(env, null, "display")) };
}

// ---------- speakers and the judges' photo ----------

async function speakerList(env) {
  const { results } = await env.DB.prepare("SELECT id, source, source_ref, logo_at FROM screen_logos WHERE deleted_at IS NULL AND logo_at IS NOT NULL").all();
  return SPEAKERS.map((x) => {
    const row = results.find((r) => r.source === x.source && String(r.source_ref) === x.ref);
    return { ...x, logo: row ? `/api/logo?id=${row.id}&v=${encodeURIComponent(row.logo_at)}` : null };
  });
}

async function judgesPhotoPath(env) {
  const { metadata } = await env.KV.getWithMetadata(JUDGES_KEY, { type: "stream" });
  return metadata ? `/api/judges-photo?v=${encodeURIComponent(metadata.at)}` : null;
}

export async function putJudgesPhoto(env, req) {
  const { sniff, stripMetadata } = await import("./strip.js");
  const tooBig = "That photo is over 4MB. Export it smaller, about 2000 pixels wide is plenty.";
  if (Number(req.headers.get("content-length") || 0) > MAX_PHOTO) throw new HttpError(413, tooBig);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_PHOTO) throw new HttpError(413, tooBig);
  const type = sniff(bytes);
  if (type !== "image/png" && type !== "image/jpeg") throw new HttpError(415, "Upload the photo as a JPG or PNG.");
  const stored = stripMetadata(bytes, type);
  await env.KV.put(JUDGES_KEY, stored, { metadata: { type, at: now() } });
  await bump(env);
  return stageView(env);
}

export async function removeJudgesPhoto(env) {
  await env.KV.delete(JUDGES_KEY);
  await bump(env);
  return stageView(env);
}

// The display only refetches its data when the version moves.
async function bump(env) {
  await writeStage(env, await readStage(env));
}

export async function getJudgesPhoto(env) {
  const { value, metadata } = await env.KV.getWithMetadata(JUDGES_KEY, { type: "arrayBuffer" });
  if (!value) return new Response("Not found.", { status: 404 });
  return new Response(value, { headers: { "content-type": metadata.type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "access-control-allow-origin": "*" } });
}
