// Board view: a read-only look at the admin for the JCI Aso board, opened
// with one shared passcode instead of an email link.
//
// The passcode lives in the settings table (key board_access) with a
// version number. A board session cookie carries "board:<version>", so a new
// passcode or turning the view off signs every board session out at once.
// Board accounts may only call the GET routes in BOARD_CAN, and every answer
// goes through redact(): no emails, phone numbers, member codes or links that
// let the holder do something (claim, scoring, brief and display links).
// Proofs, receipts and CSV exports are never served to them.

import { HttpError, now } from "./index.js";

const KEY = "board_access";
const MAX_VISITS = 40;
const WORDS = ["amber", "anchor", "apple", "arch", "atlas", "bamboo", "banner", "basil", "beacon", "bell", "birch", "bloom", "breeze", "brick", "bridge", "brook",
  "cactus", "candle", "canyon", "cedar", "chalk", "cherry", "cliff", "clover", "cobalt", "comet", "copper", "coral", "cotton", "crane", "crystal", "daisy",
  "delta", "desert", "dune", "eagle", "ember", "falcon", "fern", "field", "flint", "forest", "fountain", "garden", "garnet", "ginger", "glacier", "granite",
  "harbor", "hazel", "heron", "hill", "honey", "indigo", "island", "ivory", "jade", "jasmine", "juniper", "kettle", "kite", "lagoon", "lantern", "lemon",
  "lily", "linen", "lotus", "maple", "marble", "meadow", "mango", "mint", "moon", "nectar", "north", "oak", "ocean", "olive", "orbit", "orchid",
  "palm", "pebble", "pepper", "pine", "planet", "plum", "prairie", "quartz", "rain", "raven", "reef", "ridge", "river", "robin", "saffron", "sage",
  "salt", "sand", "shell", "silver", "sky", "slate", "spruce", "star", "stone", "summit", "sun", "swan", "thistle", "thunder", "tiger", "timber",
  "topaz", "tulip", "valley", "velvet", "violet", "walnut", "willow", "wind", "winter", "wren", "yarrow", "zebra"];

// GET routes a board account may read. Everything else is refused.
export const BOARD_CAN = new Set(["GET list", "GET reg", "GET tables", "GET partners", "GET partner", "GET screen", "GET staff", "GET roles",
  "GET export", "GET money", "GET scoring", "GET stage", "GET checkin"]);

function randomWords(n) {
  const bytes = crypto.getRandomValues(new Uint32Array(n));
  return Array.from(bytes, (b) => WORDS[b % WORDS.length]).join("-");
}
const normal = (s) => String(s || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");

async function read(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(KEY).first();
  try { return { on: false, code: null, v: 0, visits: [], ...(row ? JSON.parse(row.value) : {}) }; } catch { return { on: false, code: null, v: 0, visits: [] }; }
}
async function write(env, b, who) {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
    .bind(KEY, JSON.stringify(b), now(), who || null).run();
}

// For the session check: is this board session still allowed?
export async function boardSessionOk(env, id) {
  const b = await read(env);
  return b.on && id === `board:${b.v}`;
}

// Admin's Settings card.
export async function boardView(env) {
  const b = await read(env);
  return { on: b.on, code: b.on ? b.code : null, visits: b.visits.slice(-15).reverse() };
}
export async function boardAction(env, body, who) {
  const b = await read(env);
  if (body.action === "on") {
    if (!b.on) { b.on = true; b.code = b.code || randomWords(4); b.v += 1; }
  } else if (body.action === "new") {
    b.on = true; b.code = randomWords(4); b.v += 1;
  } else if (body.action === "off") {
    b.on = false; b.v += 1;
  } else throw new HttpError(400, "Unknown action.");
  await write(env, b, who);
  return boardView(env);
}

function device(ua) {
  const s = String(ua || "");
  const os = /iPhone|iPad/.test(s) ? "iPhone or iPad" : /Android/.test(s) ? "Android" : /Mac OS X/.test(s) ? "Mac" : /Windows/.test(s) ? "Windows" : /Linux/.test(s) ? "Linux" : "Unknown device";
  const br = /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "";
  return br ? `${os}, ${br}` : os;
}

// Checks a typed passcode. Ten tries an hour per connection; a match is
// logged with the time and a rough device description, nothing more.
export async function boardLogin(env, req, typed) {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const rl = `rl:board:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const n = Number(await env.KV.get(rl)) || 0;
  if (n >= 10) return { error: "Too many tries from this connection. Wait an hour, or ask Hadeezah for the passcode again." };
  await env.KV.put(rl, String(n + 1), { expirationTtl: 3700 });
  const b = await read(env);
  const want = normal(b.code), got = normal(typed);
  let diff = want.length ^ got.length;
  for (let i = 0; i < Math.max(want.length, got.length); i++) diff |= (want.charCodeAt(i) || 0) ^ (got.charCodeAt(i) || 0);
  if (!b.on || !want || diff) return { error: "That passcode did not work. Check it and try again." };
  b.visits = [...b.visits, { at: now(), device: device(req.headers.get("user-agent")) }].slice(-MAX_VISITS);
  await write(env, b);
  return { id: `board:${b.v}` };
}

// ---------- what a board account receives ----------

const EMAIL_RE = /[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}/gi;
const HIDE = /^(email|phone|recipient|to|contact_email|contact_phone|member_no|code|verified_by|created_by|changed_by|updated_by|who)$/i;
const DROP = /token|secret|url|link|claim_|manage|^k$|^t$/i;

export function redact(v, key = "") {
  if (Array.isArray(v)) return v.map((x) => redact(x, key));
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (DROP.test(k)) out[k] = null;
      else if (HIDE.test(k) && x !== null && x !== undefined && x !== "") out[k] = typeof x === "string" || typeof x === "number" ? "hidden" : redact(x, k);
      else out[k] = redact(x, k);
    }
    return out;
  }
  if (typeof v === "string") {
    if (/https?:\/\//i.test(v) || /[?&](k|t|m|claim|sponsor|ticket|answer)=/.test(v)) return null;
    return v.replace(EMAIL_RE, "hidden");
  }
  return v;
}
