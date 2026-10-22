// Settings for the day, editable on the admin Settings tab without a code
// change. Stored one JSON value per key in the settings table; anything not
// stored uses the default here. All times are Abuja time (WAT, UTC+1).

import { HttpError, now } from "./index.js";

export const DEFAULTS = {
  min_table_size: 5,
  teams_announced_at: "2026-11-06T15:00:00Z",   // 4:00pm on Friday 6 November
  teams_frozen: false,                          // set by "Teams have been announced"
  brief_unlock_at: "2026-11-07T06:00:00Z",      // 7:00am on Saturday 7 November
  event_day: "2026-11-07",                      // judges' links work on this day only
  arrival_time: { facilitator: "8:00am", mentor: "10:15am", judge: "10:15am" },
  spokesperson: null,                           // a judge's ticket id
  chair_name: "Hadeezah Balarabe Musa",
  chair_phone: "+234 703 390 1986",
  checkin_enabled: false,
  sprint_start: "10:50",
  presentations_start: "13:30",
  presentation_minutes: 10,
  changeover_minutes: 2,
  sprint_minutes: 50,
  critique_minutes: 35,
  response_minutes: 15,
  schedule: [
    { t: "8:30", what: "Arrival, tea and light snacks" },
    { t: "10:50", what: "The sprint opens" },
    { t: "11:40", what: "Plans handed over" },
    { t: "11:45", what: "Critique" },
    { t: "12:20", what: "Response" },
    { t: "12:35", what: "Lunch" },
    { t: "13:30", what: "Presentations" },
    { t: "14:50", what: "Feedback and recognitions" },
  ],
  rebalance_dismissed: "",                      // the table counts the flag was dismissed for
};

const MINUTES = ["presentation_minutes", "changeover_minutes", "sprint_minutes", "critique_minutes", "response_minutes"];
const CLOCK = /^([01]?\d|2[0-3]):[0-5]\d$/;
const ARRIVAL = /^(1[0-2]|[1-9]):[0-5]\d(am|pm)$/;

export async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const s = structuredClone(DEFAULTS);
  for (const r of results) if (r.key in DEFAULTS) { try { s[r.key] = JSON.parse(r.value); } catch { /* keep the default */ } }
  return s;
}

// Teams are frozen once announced: by the time, or earlier by the button.
export function isFrozen(s, at = Date.now()) {
  return !!s.teams_frozen || at >= Date.parse(s.teams_announced_at);
}

// The calendar day in Abuja for a moment, as YYYY-MM-DD.
export function abujaDay(at = Date.now()) {
  return new Date(at + 3600000).toISOString().slice(0, 10);
}

// "7:00am on Saturday 7 November"
export function abujaLabel(iso) {
  const d = new Date(Date.parse(iso) + 3600000);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  const time = `${h % 12 || 12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
  const day = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const [weekday, ...rest] = day.replace(",", "").split(" ");
  return `${time} on ${weekday} ${rest.join(" ")}`;
}

// "10:50" plus minutes, as "11:40"
export function addClock(hhmm, minutes) {
  const [h, m] = hhmm.split(":").map(Number);
  const t = h * 60 + m + minutes;
  return `${Math.floor(t / 60) % 24}:${String(t % 60).padStart(2, "0")}`;
}

function check(key, v) {
  if (MINUTES.includes(key) || key === "min_table_size") {
    const n = Number(v);
    const [lo, hi] = key === "min_table_size" ? [2, 8] : [1, 180];
    if (!Number.isInteger(n) || n < lo || n > hi) throw new HttpError(400, `Choose a whole number from ${lo} to ${hi}.`);
    return n;
  }
  if (["teams_announced_at", "brief_unlock_at"].includes(key)) {
    // Sent from the page as an Abuja date and time, "2026-11-07T07:00".
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v))) throw new HttpError(400, "Choose a date and time.");
    return new Date(Date.parse(v + ":00Z") - 3600000).toISOString();
  }
  if (key === "event_day") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new HttpError(400, "Choose a date.");
    return v;
  }
  if (key === "sprint_start" || key === "presentations_start") {
    if (!CLOCK.test(String(v))) throw new HttpError(400, "Use a 24-hour time such as 10:50.");
    return String(v).replace(/^0/, "");
  }
  if (key === "arrival_time") {
    const out = {};
    for (const role of ["facilitator", "mentor", "judge"]) {
      const t = String(v?.[role] || "").replace(/\s+/g, "").toLowerCase();
      if (!ARRIVAL.test(t)) throw new HttpError(400, "Write arrival times like 8:00am or 10:15am.");
      out[role] = t;
    }
    return out;
  }
  if (key === "checkin_enabled" || key === "teams_frozen") return !!v;
  if (key === "spokesperson") return v ? Number(v) : null;
  if (key === "chair_name" || key === "chair_phone") {
    const t = String(v || "").trim().slice(0, 80);
    if (!t) throw new HttpError(400, "This cannot be empty.");
    return t;
  }
  if (key === "schedule") {
    if (!Array.isArray(v) || v.length > 14) throw new HttpError(400, "The schedule needs between one and 14 lines.");
    return v.map((r) => {
      const t = String(r.t || "").trim(), what = String(r.what || "").trim().slice(0, 60);
      if (!/^\d{1,2}:\d{2}$/.test(t) || !what) throw new HttpError(400, "Each schedule line needs a time like 10:50 and what happens.");
      return { t, what };
    });
  }
  if (key === "rebalance_dismissed") return String(v || "");
  throw new HttpError(400, "That setting does not exist.");
}

// Save some settings. Unfreezing is refused: once teams are announced, they stay announced.
export async function saveSettings(env, patch, who) {
  const cur = await getSettings(env);
  const rows = [];
  for (const [key, raw] of Object.entries(patch || {})) {
    if (!(key in DEFAULTS)) throw new HttpError(400, "That setting does not exist.");
    const v = check(key, raw);
    if (key === "teams_frozen" && cur.teams_frozen && !v) throw new HttpError(409, "Teams have been announced, so they stay frozen.");
    rows.push(env.DB.prepare(`INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .bind(key, JSON.stringify(v), now(), who));
  }
  if (rows.length) await env.DB.batch(rows);
  return getSettings(env);
}
