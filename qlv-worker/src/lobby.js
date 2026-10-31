// The QLV lobby and team rooms (QLV-2026-Team-Rooms-Build-Spec.md).
//
// One personal link per person (lobby_access.token) opens the lobby; once
// admin presses "Open team rooms" after the freeze, the same link opens the
// person's team room, with the lobby still one tab away. Admin opens the
// lobby by hand: everyone already holding a ticket is emailed their link, and
// from then on the link travels inside each new ticket email. Anyone the
// ticket email could not cover (mentors, the Lead Sprint Marshal, a role
// changed later) is emailed by the minute tick in tick().
//
// Who is in: participants (standard, member, corporate, sponsored, partner),
// mentors and advisers who are not judging, and facilitators. Judges never
// are, so judging stays impartial; someone marked both mentor and judge
// counts as a judge. Participants see their own table's room only, mentors
// their two tables, the Lead Sprint Marshal every room, floor facilitators
// the lobby only. Nothing here ever shows an email, a phone number, a count
// of registrations, or anything from the briefs and tasks.

import { HttpError, now, token, sendMail } from "./index.js";
import { tableName } from "./config.js";
import { getSettings, isFrozen } from "./settings.js";
import { staffPeople, assignPlan, tablesNow } from "./briefings.js";
import { sendBatch, dailyRoom } from "./mailer.js";
import * as mail from "./emails.js";
import { sendPush, vapidKeys } from "./webpush.js";

const PARTICIPANT = ["standard", "member", "corporate", "sponsored", "partner"];
const STATE_DEFAULT = {
  open: false, opened_at: null,
  rooms_open: false, rooms_opened_at: null, announce_cursor: 0,
  close_at: "2026-11-08T22:59:00Z", closed: false,
  meet_link: "", explainer_link: "",
};
const MAX_MESSAGE = 280, MAX_INTRO = 140, MAX_POST = 600;
const PUSH_PER_RUN = 35;          // the free plan allows 50 outside calls per request
const TEAM_GAP = 15 * 60000;      // one team notification per person every 15 minutes
const SATURDAY = "Arrive from 8:30am · Transcorp Hilton, Abuja · Find your table by the name on your badge.";
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)$/;

const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const first = (name) => String(name || "").trim().split(/\s+/)[0] || "";
function short(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.` : parts[0] || "";
}
// Africa/Lagos is UTC+1 all year. No notifications from 10:00pm to 7:00am.
// TEST_CLOCK_SHIFT (local testing only) moves this clock to test either side.
let clockShift = 0;
export const setClockShift = (ms) => { clockShift = Number(ms) || 0; };
export function quietHours(at = Date.now() + clockShift) {
  const h = new Date(at + 3600000).getUTCHours();
  return h >= 22 || h < 7;
}
export const lobbyUrl = (env, tok) => `${env.SITE_URL}my/?t=${tok}`;

// ---------- state ----------

export async function lobbyState(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'lobby'").first();
  let v = {};
  try { v = row ? JSON.parse(row.value) : {}; } catch { /* defaults */ }
  return { ...STATE_DEFAULT, ...v };
}
async function saveState(env, st, who) {
  await env.DB.prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('lobby', ?, ?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
    .bind(JSON.stringify(st), now(), who || null).run();
}
export const isShut = (st, at = Date.now()) => st.closed || at >= Date.parse(st.close_at);

// ---------- who is in ----------

// Everyone with a lobby place, worked out fresh each time so a cancelled
// ticket or a changed role takes effect at once.
export async function lobbyPeople(env) {
  const [parts, staff, tables] = await Promise.all([
    env.DB.prepare(`SELECT t.id, t.kind, t.name, t.email, t.ticket_ref, t.table_index, t.late_after_freeze, t.sent_at,
        CASE
          WHEN t.kind = 'partner' THEN p.name
          WHEN t.kind = 'corporate' THEN r.organisation
          WHEN NULLIF(t.organisation, '') IS NOT NULL THEN t.organisation
          WHEN t.kind IN ('standard', 'member') AND (r.size = 1 OR lower(t.email) = lower(r.email)) THEN NULLIF(r.organisation, '')
        END AS org
      FROM tickets t JOIN registrations r ON r.ref = t.reg_ref LEFT JOIN partners p ON p.id = t.partner_id
      WHERE t.kind IN ('standard', 'member', 'corporate', 'sponsored', 'partner') AND t.sent_at IS NOT NULL
        AND t.cancelled_at IS NULL AND t.ticket_ref != 'pending'
      ORDER BY t.sent_at, t.id`).all(),
    staffPeople(env), tablesNow(env),
  ]);
  const plan = assignPlan(staff, tables);
  const out = parts.results.map((t) => ({
    id: t.id, kind: t.kind, name: t.name, email: t.email, ref: t.ticket_ref, org: t.org || "", role: "participant",
    table: t.table_index, late: !!t.late_after_freeze,
    rooms: t.table_index !== null && t.table_index !== undefined && !t.late_after_freeze ? [t.table_index] : [],
  }));
  for (const s of staff) {
    if (s.judge) continue;
    const base = { id: s.id, kind: s.kind, name: s.name, email: s.email, ref: s.ref, org: "", table: null, late: false };
    if (s.kind === "facilitator") {
      if (s.facilitatorType === "lead") out.push({ ...base, role: "marshal", rooms: tables });
      else out.push({ ...base, role: "facilitator", rooms: [] });
    } else if (s.mentor) {
      const rooms = s.tables?.length ? s.tables : plan[s.id]?.tables || [];
      out.push({ ...base, role: "mentor", rooms });
    }
  }
  return out;
}

const ROLE_LABEL = { participant: "", mentor: "Mentor", marshal: "Lead Sprint Marshal", facilitator: "QLV team" };

// The person behind a link, if the link is live and they still have a place.
async function personFor(env, tok) {
  const t = String(tok || "");
  if (t.length < 32) throw new HttpError(404, "This link is not valid.", "bad_link");
  const a = await env.DB.prepare("SELECT * FROM lobby_access WHERE token = ?").bind(t).first();
  if (!a || a.revoked_at) throw new HttpError(404, "This link is no longer active. Use the newest link we emailed you, or sign in with your ticket reference.", "bad_link");
  const person = (await lobbyPeople(env)).find((p) => p.id === a.ticket_id);
  if (!person) throw new HttpError(404, "This link is no longer active.", "bad_link");
  return { person, access: a };
}

// The live link for a ticket, made on first use. Tokens are random and never
// derived from the ticket reference.
async function accessFor(env, ticketId) {
  const live = await env.DB.prepare("SELECT * FROM lobby_access WHERE ticket_id = ? AND revoked_at IS NULL ORDER BY id DESC LIMIT 1").bind(ticketId).first();
  if (live) return live;
  const tok = token(40);
  await env.DB.prepare("INSERT INTO lobby_access (ticket_id, token, created_at) VALUES (?, ?, ?)").bind(ticketId, tok, now()).run();
  return env.DB.prepare("SELECT * FROM lobby_access WHERE token = ?").bind(tok).first();
}

// For ticket emails: the lobby link to put inside, once the lobby is open.
// Only participants get it this way; staff roles can still change, so they
// hear from tick(). With mark, the person counts as told.
export async function lobbyLinkForTicket(env, ticket, mark = true) {
  if (!PARTICIPANT.includes(ticket.kind)) return null;
  const st = await lobbyState(env);
  if (!st.open || isShut(st)) return null;
  const a = await accessFor(env, ticket.id);
  if (mark && !a.notified_at) await env.DB.prepare("UPDATE lobby_access SET notified_at = ?, notified_by = 'ticket' WHERE id = ? AND notified_at IS NULL").bind(now(), a.id).run();
  return lobbyUrl(env, a.token);
}
export async function markLobbyTold(env, ticketId) {
  await env.DB.prepare("UPDATE lobby_access SET notified_at = ?, notified_by = 'ticket' WHERE ticket_id = ? AND revoked_at IS NULL AND notified_at IS NULL").bind(now(), ticketId).run();
}

// ---------- reading ----------

// {meet_link} and {explainer_link} filled in; null when one is still empty,
// so the post waits.
export function fillPost(body, st) {
  let out = body, missing = [];
  for (const k of ["meet_link", "explainer_link"]) {
    if (!out.includes(`{${k}}`)) continue;
    if (!st[k]) missing.push(k);
    else out = out.split(`{${k}}`).join(st[k]);
  }
  return missing.length ? null : out;
}
function splitPost(text) {
  const [title, ...rest] = text.split("\n");
  return { title, text: rest.join("\n").trim() };
}

function spacesFor(person, st) {
  return st.rooms_open ? person.rooms : [];
}
function canSee(person, st, space) {
  if (space === "lobby") return true;
  const m = /^t:(\d+)$/.exec(space);
  return !!m && spacesFor(person, st).includes(Number(m[1]));
}

async function messages(env, space, after = 0, ticketId = null) {
  const { results } = await env.DB.prepare(`SELECT m.id, m.ticket_id, m.sender_role, m.body, m.created_at, t.name FROM lobby_messages m LEFT JOIN tickets t ON t.id = m.ticket_id
    WHERE m.space = ? AND m.hidden = 0 AND m.id > ? ORDER BY m.id DESC LIMIT 80`).bind(space, Number(after) || 0).all();
  return results.reverse().map((m) => ({
    id: m.id, who: first(m.name) || "QLV team", role: ROLE_LABEL[m.sender_role] || "", mine: ticketId !== null && m.ticket_id === ticketId, body: m.body, at: m.created_at,
  }));
}

async function markRead(env, ticketId, space) {
  await env.DB.prepare("INSERT INTO lobby_reads (ticket_id, space, last_read_at) VALUES (?, ?, ?) ON CONFLICT (ticket_id, space) DO UPDATE SET last_read_at = excluded.last_read_at")
    .bind(ticketId, space, now()).run();
}

// Unread posts and messages, for the number on the home screen icon.
async function unreadFor(env, person, st) {
  const spaces = ["lobby", ...spacesFor(person, st).map((t) => `t:${t}`)];
  const reads = Object.fromEntries((await env.DB.prepare("SELECT space, last_read_at FROM lobby_reads WHERE ticket_id = ?").bind(person.id).all()).results.map((r) => [r.space, r.last_read_at]));
  let n = 0;
  const since = (s) => reads[s] || "1970-01-01";
  n += (await env.DB.prepare("SELECT COUNT(*) AS n FROM lobby_posts WHERE status = 'sent' AND sent_at > ? AND (audience = 'lobby' OR ? = 1)")
    .bind(since("lobby"), spaces.length > 1 ? 1 : 0).first()).n;
  for (const s of spaces) {
    if (s === "lobby") continue; // lobby wall messages never notify, so they never count
    n += (await env.DB.prepare("SELECT COUNT(*) AS n FROM lobby_messages WHERE space = ? AND hidden = 0 AND created_at > ? AND (ticket_id IS NULL OR ticket_id != ?)").bind(s, since(s), person.id).first()).n;
  }
  return n;
}

async function introsOf(env, people) {
  const { results } = await env.DB.prepare("SELECT * FROM lobby_intros").all();
  const by = Object.fromEntries(results.map((r) => [r.ticket_id, r]));
  return (p) => {
    const i = by[p.id] || {};
    return { short: short(p.name), org: i.hide_org ? "" : p.org, what: i.what_you_do || "", hoping: i.hoping_for || "", role: ROLE_LABEL[p.role] || "" };
  };
}

// The whole page behind a personal link.
export async function myView(env, url) {
  const st = await lobbyState(env);
  const { person, access } = await personFor(env, url.searchParams.get("t"));
  const standalone = url.searchParams.get("app") === "1";
  await env.DB.prepare("UPDATE lobby_access SET last_opened_at = ?, installed = MAX(installed, ?) WHERE id = ?").bind(now(), standalone ? 1 : 0, access.id).run();
  const me = { first: first(person.name), short: short(person.name), role: person.role, roleLabel: ROLE_LABEL[person.role] };
  if (!st.open) return { state: "before", me };
  const s = await getSettings(env);
  const shut = isShut(st);
  const everyone = await lobbyPeople(env);
  const card = await introsOf(env, everyone);
  const mine = (await env.DB.prepare("SELECT * FROM lobby_intros WHERE ticket_id = ?").bind(person.id).first()) || {};
  const posts = (await env.DB.prepare("SELECT id, audience, body, sent_at FROM lobby_posts WHERE status = 'sent' ORDER BY sent_at DESC").all()).results
    .map((p) => ({ id: p.id, audience: p.audience, at: p.sent_at, ...splitPost(fillPost(p.body, st) ?? p.body) }));
  const rooms = [];
  for (const t of spacesFor(person, st)) {
    const members = everyone.filter((p) => p.role === "participant" && p.rooms.includes(t));
    const mentors = everyone.filter((p) => p.role === "mentor" && p.rooms.includes(t));
    rooms.push({
      space: `t:${t}`, name: tableName(t),
      members: members.map(card), mentors: mentors.map((p) => short(p.name)),
      messages: await messages(env, `t:${t}`, 0, person.id),
    });
  }
  await markRead(env, person.id, "lobby");
  for (const r of rooms) await markRead(env, person.id, r.space);
  return {
    state: shut ? "closed" : "open",
    me: { ...me, note: person.role === "participant" && st.rooms_open && !person.rooms.length ? "You'll be seated at a table on the day." : "" },
    roomsOpen: !!st.rooms_open,
    countdownTo: s.teams_announced_at, announceLabel: "Teams are announced on Friday at 4:45pm.",
    saturday: SATURDAY,
    posts: posts.filter((p) => p.audience === "lobby"),
    roomPosts: posts.filter((p) => p.audience === "rooms"),
    people: everyone.map(card),
    intro: { what: mine.what_you_do || "", hoping: mine.hoping_for || "", hideOrg: !!mine.hide_org, org: person.org },
    lobby: await messages(env, "lobby", 0, person.id),
    rooms,
    push: { key: (await vapidKeys(env)).publicKey, state: access.push_state || null },
    installed: !!access.installed || standalone,
  };
}

// The 10 second refresh: new messages in one space, nothing else. It runs
// often on every open phone, so it reads a handful of rows rather than
// working out everyone's place (D1's free plan counts rows read).
async function quickAccess(env, tok, space, st) {
  const t = String(tok || "");
  const row = t.length >= 32 ? await env.DB.prepare(`SELECT a.ticket_id, a.revoked_at, t.kind, t.table_index, t.late_after_freeze, t.cancelled_at,
      sr.mentor, sr.judge, sr.facilitator_type, sr.tables
    FROM lobby_access a JOIN tickets t ON t.id = a.ticket_id LEFT JOIN staff_roles sr ON sr.ticket_id = t.id WHERE a.token = ?`).bind(t).first() : null;
  if (!row || row.revoked_at || row.cancelled_at || row.judge) throw new HttpError(404, "This link is no longer active.", "bad_link");
  if (space === "lobby") return row.ticket_id;
  const n = Number((/^t:(\d+)$/.exec(space) || [])[1]);
  if (!st.rooms_open || !Number.isInteger(n)) throw new HttpError(403, "This room is not open to you.");
  const ok = PARTICIPANT.includes(row.kind) ? row.table_index === n && !row.late_after_freeze
    : row.kind === "facilitator" ? row.facilitator_type === "lead"
    : !!row.mentor && JSON.parse(row.tables || "[]").includes(n);
  // A mentor whose tables were never saved falls back to the full check.
  if (!ok && row.mentor && !JSON.parse(row.tables || "[]").length) {
    const { person } = await personFor(env, t);
    if (canSee(person, st, space)) return row.ticket_id;
  }
  if (!ok) throw new HttpError(403, "This room is not open to you.");
  return row.ticket_id;
}
export async function myWall(env, url) {
  const st = await lobbyState(env);
  const space = String(url.searchParams.get("space") || "lobby");
  if (!st.open) throw new HttpError(403, "The lobby is not open yet.");
  const ticketId = await quickAccess(env, url.searchParams.get("t"), space, st);
  const out = await messages(env, space, url.searchParams.get("after"), ticketId);
  if (out.length) await markRead(env, ticketId, space);
  return { messages: out, closed: isShut(st), roomsOpen: !!st.rooms_open };
}

// ---------- writing ----------

export async function saveIntro(env, b) {
  const st = await lobbyState(env);
  const { person } = await personFor(env, b.t);
  if (!st.open || isShut(st)) throw new HttpError(403, "The lobby is closed.");
  const what = clean(b.what, MAX_INTRO), hoping = clean(b.hoping, MAX_INTRO);
  await env.DB.prepare(`INSERT INTO lobby_intros (ticket_id, what_you_do, hoping_for, hide_org, updated_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (ticket_id) DO UPDATE SET what_you_do = excluded.what_you_do, hoping_for = excluded.hoping_for, hide_org = excluded.hide_org, updated_at = excluded.updated_at`)
    .bind(person.id, what || null, hoping || null, b.hideOrg ? 1 : 0, now()).run();
  return { ok: true };
}

export async function postMessage(env, b, ctx) {
  const st = await lobbyState(env);
  const { person } = await personFor(env, b.t);
  const space = String(b.space || "lobby");
  if (!st.open) throw new HttpError(403, "The lobby is not open yet.");
  if (isShut(st)) throw new HttpError(403, "This room has closed. Thank you for being part of QLV 2026.", "closed");
  if (!canSee(person, st, space)) throw new HttpError(403, "This room is not open to you.");
  const body = clean(b.body, MAX_MESSAGE + 1).replace(/\n{3,}/g, "\n\n");
  if (!body) throw new HttpError(400, "Write something first.");
  if (body.length > MAX_MESSAGE) throw new HttpError(400, `Keep it to ${MAX_MESSAGE} characters.`);
  const since = new Date(Date.now() - 60000).toISOString();
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM lobby_messages WHERE ticket_id = ? AND created_at > ?").bind(person.id, since).first();
  if (n >= 6) throw new HttpError(429, "That's a lot of messages in a minute. Wait a moment and try again.");
  const stamp = now();
  const row = await env.DB.prepare("INSERT INTO lobby_messages (space, ticket_id, sender_role, body, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id")
    .bind(space, person.id, person.role, body, stamp).first();
  await markRead(env, person.id, space);
  if (space !== "lobby") ctx.waitUntil(teamNotify(env, person, Number(space.slice(2))).catch(() => {}));
  return { message: { id: row.id, who: first(person.name), role: ROLE_LABEL[person.role] || "", mine: true, body, at: stamp } };
}

export async function savePush(env, b) {
  const { person, access } = await personFor(env, b.t);
  const state = ["on", "off", "denied"].includes(b.state) ? b.state : null;
  const sub = b.subscription;
  if (sub) {
    let host = "";
    try { host = new URL(String(sub.endpoint)).hostname; } catch { /* checked below */ }
    // PUSH_TEST_HOST is set only in local testing, for a stand-in push service.
    const testing = env.PUSH_TEST_HOST && String(sub.endpoint).startsWith(`http://${env.PUSH_TEST_HOST}/`);
    if (!testing && (!String(sub.endpoint).startsWith("https://") || !PUSH_HOSTS.test(host))) throw new HttpError(400, "That subscription was not accepted.");
    if (!sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError(400, "That subscription was not accepted.");
    await env.DB.prepare(`INSERT INTO push_subs (ticket_id, endpoint, p256dh, auth, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT (endpoint) DO UPDATE SET ticket_id = excluded.ticket_id, p256dh = excluded.p256dh, auth = excluded.auth`)
      .bind(person.id, String(sub.endpoint).slice(0, 1000), clean(sub.keys.p256dh, 200), clean(sub.keys.auth, 100), now()).run();
  }
  if (b.remove) await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ? AND ticket_id = ?").bind(String(b.remove), person.id).run();
  await env.DB.prepare("UPDATE lobby_access SET push_state = COALESCE(?, push_state), installed = MAX(installed, ?) WHERE id = ?").bind(state, b.installed ? 1 : 0, access.id).run();
  return { ok: true };
}

// The home screen app's manifest, made for each person so the icon opens
// their own link (on iPhones the app does not share Safari's storage).
export async function manifest(env, url) {
  const { access } = await personFor(env, url.searchParams.get("t"));
  const start = `${lobbyUrl(env, access.token)}&app=1`;
  const body = {
    name: "QLV 2026", short_name: "QLV", id: start, start_url: start, scope: `${env.SITE_URL}my/`,
    display: "standalone", theme_color: "#0F2B63", background_color: "#0A1F4D",
    icons: [192, 512].map((n) => ({ src: `${env.SITE_URL}assets/app-${n}.png`, sizes: `${n}x${n}`, type: "image/png", purpose: "any" })),
  };
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/manifest+json", "access-control-allow-origin": "*", "cache-control": "no-store" } });
}

// Backup sign-in: ticket reference and the email used to register, both
// matching. Five failed tries from one connection pause it for 15 minutes.
export async function signIn(env, req, b) {
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const key = `rl:mysignin:${ip}`;
  const fails = Number(await env.KV.get(key)) || 0;
  if (fails >= 5) throw new HttpError(429, "Too many tries. Wait 15 minutes and try again.", "paused");
  const ref = clean(b.ref, 30).toUpperCase().replace(/\s+/g, ""), email = clean(b.email, 160).toLowerCase();
  const people = ref && email ? await lobbyPeople(env) : [];
  const person = people.find((p) => String(p.ref).toUpperCase() === ref && String(p.email || "").toLowerCase() === email);
  if (!person) {
    await env.KV.put(key, String(fails + 1), { expirationTtl: 900 });
    throw new HttpError(404, "We could not match that reference and email. Check both against your ticket email.", "no_match");
  }
  const st = await lobbyState(env);
  if (!st.open) throw new HttpError(409, "The QLV lobby isn't open yet. We'll email you your link when it is.", "before");
  const a = await accessFor(env, person.id);
  return { token: a.token };
}

// ---------- notifications ----------

async function subsOf(env, ticketIds) {
  if (!ticketIds.length) return [];
  return (await env.DB.prepare(`SELECT * FROM push_subs WHERE ticket_id IN (SELECT value FROM json_each(?)) ORDER BY id`).bind(JSON.stringify(ticketIds)).all()).results;
}
async function pushTo(env, subs, payloadFor) {
  for (const s of subs) {
    const r = await sendPush(env, s, await payloadFor(s.ticket_id));
    if (r === "gone") await env.DB.prepare("DELETE FROM push_subs WHERE id = ?").bind(s.id).run();
    else if (r === "ok") await env.DB.prepare("UPDATE push_subs SET last_success_at = ? WHERE id = ?").bind(now(), s.id).run();
  }
}

// A new message in a team room: tell the rest of that team, at most once
// every 15 minutes each and never overnight. The rest wait in push_queue and
// go as one grouped notification from tick().
async function teamNotify(env, sender, table) {
  const st = await lobbyState(env);
  const people = await lobbyPeople(env);
  const space = `t:${table}`, name = tableName(table);
  const team = people.filter((p) => p.id !== sender.id && p.role !== "marshal" && p.rooms.includes(table));
  const subs = await subsOf(env, team.map((p) => p.id));
  const withSubs = new Set(subs.map((s) => s.ticket_id));
  const sendNow = [];
  for (const p of team.filter((x) => withSubs.has(x.id))) {
    const q = await env.DB.prepare("SELECT * FROM push_queue WHERE ticket_id = ? AND space = ?").bind(p.id, space).first();
    const recent = q?.last_sent_at && Date.now() - Date.parse(q.last_sent_at) < TEAM_GAP;
    if (quietHours() || recent) {
      await env.DB.prepare("INSERT INTO push_queue (ticket_id, space, pending) VALUES (?, ?, 1) ON CONFLICT (ticket_id, space) DO UPDATE SET pending = pending + 1").bind(p.id, space).run();
    } else {
      sendNow.push(p.id);
      await env.DB.prepare("INSERT INTO push_queue (ticket_id, space, pending, last_sent_at) VALUES (?, ?, 0, ?) ON CONFLICT (ticket_id, space) DO UPDATE SET pending = 0, last_sent_at = excluded.last_sent_at").bind(p.id, space, now()).run();
    }
  }
  const body = sender.role === "mentor" ? `Your mentor posted in ${name}` : `${first(sender.name)} posted in ${name}`;
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  await pushTo(env, subs.filter((s) => sendNow.includes(s.ticket_id)).slice(0, PUSH_PER_RUN), async (id) => {
    const a = await accessFor(env, id);
    return { title: "QLV 2026", body, url: `${lobbyUrl(env, a.token)}#${space}`, tag: space, badge: await unreadFor(env, byId[id], st) };
  });
}

// ---------- admin ----------

export async function openLobby(env, who) {
  const st = await lobbyState(env);
  if (st.open) throw new HttpError(409, "The lobby is already open.");
  st.open = true;
  st.opened_at = now();
  await saveState(env, st, who);
  // Posts whose time has already passed appear quietly, without a notification.
  const { results } = await env.DB.prepare("SELECT * FROM lobby_posts WHERE status = 'scheduled' AND send_at <= ?").bind(st.opened_at).all();
  for (const p of results) {
    if (fillPost(p.body, st) === null) continue;
    await env.DB.prepare("UPDATE lobby_posts SET status = 'sent', sent_at = ?, notified = -1 WHERE id = ?").bind(p.send_at, p.id).run();
  }
  const sent = await sendWelcomes(env);
  return { ...(await lobbyAdmin(env)), sent };
}

// Lobby emails to everyone with a place who has not had their link yet,
// within the day's email allowance. The rest go on the next tick with room.
export async function sendWelcomes(env, max = 90) {
  const st = await lobbyState(env);
  if (!st.open || isShut(st)) return 0;
  const told = new Set((await env.DB.prepare("SELECT ticket_id FROM lobby_access WHERE revoked_at IS NULL AND notified_at IS NOT NULL").all()).results.map((r) => r.ticket_id));
  const waiting = (await lobbyPeople(env)).filter((p) => !told.has(p.id) && p.email);
  if (!waiting.length) return 0;
  const { room } = await dailyRoom(env);
  const batch = waiting.slice(0, Math.min(room, max));
  if (!batch.length) return 0;
  const msgs = [];
  for (const p of batch) {
    const a = await accessFor(env, p.id);
    msgs.push({ ref: p.ref, to: p.email, ...mail.lobbyWelcome(first(p.name), lobbyUrl(env, a.token)), id: a.id });
  }
  await sendBatch(env, msgs.map(({ id, ...m }) => m), "lobby_welcome");
  await env.DB.prepare("UPDATE lobby_access SET notified_at = ?, notified_by = 'welcome' WHERE id IN (SELECT value FROM json_each(?))").bind(now(), JSON.stringify(msgs.map((m) => m.id))).run();
  return batch.length;
}

export async function openRooms(env, who) {
  const st = await lobbyState(env);
  if (!st.open) throw new HttpError(409, "Open the lobby first.");
  if (st.rooms_open) throw new HttpError(409, "Team rooms are already open.");
  if (!isFrozen(await getSettings(env))) throw new HttpError(409, "Team rooms open only after the teams are announced (Settings, Teams have been announced).");
  st.rooms_open = true;
  st.rooms_opened_at = now();
  st.announce_cursor = 0;
  await saveState(env, st, who);
  const sent = await sendAnnouncements(env);
  await announcePush(env);
  return { ...(await lobbyAdmin(env)), sent };
}

// "Meet your QLV 2026 team" to everyone on a table, within the allowance.
async function sendAnnouncements(env) {
  const st = await lobbyState(env);
  if (!st.rooms_open || isShut(st)) return 0;
  const done = new Set((await env.DB.prepare("SELECT ticket_id FROM lobby_access WHERE revoked_at IS NULL AND announced_at IS NOT NULL").all()).results.map((r) => r.ticket_id));
  const waiting = (await lobbyPeople(env)).filter((p) => p.role === "participant" && p.rooms.length && p.email && !done.has(p.id));
  const { room } = await dailyRoom(env);
  const batch = waiting.slice(0, room);
  if (!batch.length) return 0;
  const msgs = [];
  for (const p of batch) {
    const a = await accessFor(env, p.id);
    msgs.push({ ref: p.ref, to: p.email, ...mail.teamAnnounced(first(p.name), tableName(p.rooms[0]), `${lobbyUrl(env, a.token)}#t:${p.rooms[0]}`), id: a.id });
  }
  await sendBatch(env, msgs.map(({ id, ...m }) => m), "rooms_announced");
  await env.DB.prepare("UPDATE lobby_access SET announced_at = ?, notified_at = COALESCE(notified_at, ?), notified_by = COALESCE(notified_by, 'welcome') WHERE id IN (SELECT value FROM json_each(?))")
    .bind(now(), now(), JSON.stringify(msgs.map((m) => m.id))).run();
  return batch.length;
}

// The announcement notification, in runs of PUSH_PER_RUN. Not held overnight.
async function announcePush(env) {
  const st = await lobbyState(env);
  if (!st.rooms_open || st.announce_cursor < 0 || isShut(st)) return;
  const people = await lobbyPeople(env);
  const onTable = people.filter((p) => p.role === "participant" && p.rooms.length);
  const byId = Object.fromEntries(onTable.map((p) => [p.id, p]));
  const subs = (await subsOf(env, onTable.map((p) => p.id))).filter((s) => s.id > st.announce_cursor);
  const run = subs.slice(0, PUSH_PER_RUN);
  await pushTo(env, run, async (id) => {
    const a = await accessFor(env, id);
    const t = byId[id].rooms[0];
    return { title: "QLV 2026", body: `Your QLV team is here. Meet team ${tableName(t)}.`, url: `${lobbyUrl(env, a.token)}#t:${t}`, tag: "teams", badge: await unreadFor(env, byId[id], st) };
  });
  const fresh = await lobbyState(env);
  fresh.announce_cursor = subs.length > run.length ? run.at(-1).id : -1;
  await saveState(env, fresh);
}

// Scheduled posts that are due go out; each then notifies its audience in
// runs of PUSH_PER_RUN (lobby_posts.notified holds the last subscription
// done, -1 once finished). A post due overnight appears without a notification.
async function duePosts(env, st) {
  const { results } = await env.DB.prepare("SELECT * FROM lobby_posts WHERE status = 'scheduled' AND send_at <= ? ORDER BY send_at").bind(now()).all();
  for (const p of results) {
    if (fillPost(p.body, st) === null) continue;
    await env.DB.prepare("UPDATE lobby_posts SET status = 'sent', sent_at = ?, notified = ? WHERE id = ? AND status = 'scheduled'").bind(now(), quietHours() ? -1 : 0, p.id).run();
  }
}
async function postPush(env, st) {
  const p = await env.DB.prepare("SELECT * FROM lobby_posts WHERE status = 'sent' AND notified >= 0 ORDER BY sent_at LIMIT 1").first();
  if (!p) return;
  const people = await lobbyPeople(env);
  const audience = p.audience === "rooms" ? people.filter((x) => spacesFor(x, st).length) : people;
  const byId = Object.fromEntries(audience.map((x) => [x.id, x]));
  const subs = (await subsOf(env, audience.map((x) => x.id))).filter((s) => s.id > p.notified);
  const run = subs.slice(0, PUSH_PER_RUN);
  const { title } = splitPost(fillPost(p.body, st) ?? p.body);
  await pushTo(env, run, async (id) => {
    const a = await accessFor(env, id);
    return { title: "QLV 2026", body: title, url: `${lobbyUrl(env, a.token)}#post-${p.id}`, tag: `post-${p.id}`, badge: await unreadFor(env, byId[id], st) };
  });
  await env.DB.prepare("UPDATE lobby_posts SET notified = ? WHERE id = ?").bind(subs.length > run.length ? run.at(-1).id : -1, p.id).run();
}
async function flushQueue(env, st) {
  if (quietHours()) return;
  const cutoff = new Date(Date.now() - TEAM_GAP).toISOString();
  const { results } = await env.DB.prepare("SELECT * FROM push_queue WHERE pending > 0 AND (last_sent_at IS NULL OR last_sent_at < ?) LIMIT 20").bind(cutoff).all();
  if (!results.length) return;
  const people = Object.fromEntries((await lobbyPeople(env)).map((p) => [p.id, p]));
  for (const q of results) {
    const p = people[q.ticket_id];
    await env.DB.prepare("UPDATE push_queue SET pending = 0, last_sent_at = ? WHERE ticket_id = ? AND space = ?").bind(now(), q.ticket_id, q.space).run();
    if (!p || !canSee(p, st, q.space)) continue;
    const name = tableName(Number(q.space.slice(2)));
    const a = await accessFor(env, p.id);
    await pushTo(env, await subsOf(env, [p.id]), async () => ({
      title: "QLV 2026", body: q.pending === 1 ? `1 new message in ${name}` : `${q.pending} new messages in ${name}`,
      url: `${lobbyUrl(env, a.token)}#${q.space}`, tag: q.space, badge: await unreadFor(env, p, st),
    }));
  }
}

// Every minute (wrangler.toml [triggers]). Each step stands alone, so one
// failing never stops the others.
export async function tick(env) {
  const st = await lobbyState(env);
  if (!st.open || isShut(st)) return;
  // The email catch-ups read more, so they run every 10 minutes, not every minute.
  const catchUp = new Date().getUTCMinutes() % 10 === 0;
  const steps = [() => duePosts(env, st), () => postPush(env, st), () => flushQueue(env, st)];
  if (catchUp) steps.push(() => sendWelcomes(env, 40), () => sendAnnouncements(env));
  if (st.rooms_open && st.announce_cursor >= 0) steps.push(() => announcePush(env));
  for (const step of steps) {
    try { await step(); } catch (err) { console.error("lobby tick", err); }
  }
}

// ---------- the Team rooms tab ----------

export async function lobbyAdmin(env) {
  const [st, s] = await Promise.all([lobbyState(env), getSettings(env)]);
  const people = await lobbyPeople(env);
  const access = Object.fromEntries((await env.DB.prepare("SELECT * FROM lobby_access WHERE revoked_at IS NULL").all()).results.map((a) => [a.ticket_id, a]));
  const subs = Object.fromEntries((await env.DB.prepare("SELECT ticket_id, COUNT(*) AS n FROM push_subs GROUP BY ticket_id").all()).results.map((r) => [r.ticket_id, r.n]));
  const intros = new Set((await env.DB.prepare("SELECT ticket_id FROM lobby_intros WHERE what_you_do IS NOT NULL OR hoping_for IS NOT NULL").all()).results.map((r) => r.ticket_id));
  const posted = Object.fromEntries((await env.DB.prepare("SELECT ticket_id, COUNT(*) AS n FROM lobby_messages WHERE ticket_id IS NOT NULL GROUP BY ticket_id").all()).results.map((r) => [r.ticket_id, r.n]));
  const posts = (await env.DB.prepare("SELECT * FROM lobby_posts ORDER BY send_at, id").all()).results;
  const opened = await env.DB.prepare("SELECT last_opened_at FROM lobby_access WHERE revoked_at IS NULL AND last_opened_at IS NOT NULL").all();
  const tables = await tablesNow(env);
  const msgs = (await env.DB.prepare("SELECT m.*, t.name FROM lobby_messages m LEFT JOIN tickets t ON t.id = m.ticket_id ORDER BY m.id DESC LIMIT 120").all()).results;
  return {
    state: { ...st, shut: isShut(st), frozen: isFrozen(s), teamsAnnouncedAt: s.teams_announced_at },
    welcomeWaiting: people.filter((p) => !access[p.id]?.notified_at && p.email).length,
    announceCount: people.filter((p) => p.role === "participant" && p.rooms.length).length,
    people: people.map((p) => {
      const a = access[p.id];
      return {
        ticketId: p.id, name: p.name, ref: p.ref, role: p.role, roleLabel: ROLE_LABEL[p.role] || "Participant",
        table: p.role === "participant" && p.table !== null && p.table !== undefined ? tableName(p.table) : p.role === "mentor" ? p.rooms.map(tableName).join(" and ") : p.role === "marshal" ? "All rooms" : "",
        late: p.late, link: a ? lobbyUrl(env, a.token) : null, told: a?.notified_at || null, toldBy: a?.notified_by || null,
        lastOpened: a?.last_opened_at || null, installed: !!a?.installed, push: subs[p.id] ? "on" : a?.push_state === "denied" ? "denied" : "off",
        intro: intros.has(p.id), posted: posted[p.id] || 0, noEmail: !p.email,
      };
    }),
    tables: tables.map((t) => {
      const members = people.filter((p) => p.role === "participant" && p.rooms.includes(t));
      return {
        name: tableName(t), members: members.length,
        opened: members.filter((p) => access[p.id]?.last_opened_at && st.rooms_opened_at && access[p.id].last_opened_at > st.rooms_opened_at).length,
        intros: members.filter((p) => intros.has(p.id)).length,
        posted: members.filter((p) => msgs.some((m) => m.ticket_id === p.id && m.space === `t:${t}`)).length,
      };
    }),
    late: people.filter((p) => p.role === "participant" && st.rooms_open && !p.rooms.length).map((p) => ({ name: p.name, ref: p.ref })),
    posts: posts.map((p) => ({
      id: p.id, audience: p.audience, body: p.body, sendAt: p.send_at, status: p.status, sentAt: p.sent_at,
      waitingFor: p.status === "scheduled" && fillPost(p.body, st) === null ? ["meet_link", "explainer_link"].filter((k) => p.body.includes(`{${k}}`) && !st[k]) : [],
      openedAfter: p.sent_at ? opened.results.filter((o) => o.last_opened_at > p.sent_at).length : null,
    })),
    messages: msgs.map((m) => ({ id: m.id, space: m.space === "lobby" ? "Lobby" : tableName(Number(m.space.slice(2))), who: m.name || "QLV team", role: ROLE_LABEL[m.sender_role] || "", body: m.body, at: m.created_at, hidden: !!m.hidden })),
  };
}

export async function lobbySettings(env, b, who) {
  const st = await lobbyState(env);
  for (const k of ["meet_link", "explainer_link"]) {
    if (!(k in b)) continue;
    const v = clean(b[k], 300);
    if (v && !/^https:\/\/\S+$/.test(v)) throw new HttpError(400, "Links must start with https://");
    st[k] = v;
  }
  if (b.close_at) {
    if (!/^2026-11-(0[1-9]|1\d|2\d|30)T\d{2}:\d{2}$/.test(b.close_at)) throw new HttpError(400, "Pick a closing date and time in November 2026.");
    st.close_at = new Date(Date.parse(`${b.close_at}:00Z`) - 3600000).toISOString(); // typed as Abuja time
  }
  if (b.closed === true || b.closed === false) st.closed = b.closed;
  await saveState(env, st, who);
  return lobbyAdmin(env);
}

export async function savePost(env, b, who) {
  const body = clean(b.body, MAX_POST + 1).replace(/\r/g, "");
  if (!body) throw new HttpError(400, "Write the post first. The first line is what shows in the notification.");
  if (body.length > MAX_POST) throw new HttpError(400, `Keep posts to ${MAX_POST} characters.`);
  const audience = b.audience === "rooms" ? "rooms" : "lobby";
  if (!/^2026-1[01]-\d{2}T\d{2}:\d{2}$/.test(String(b.sendAt || ""))) throw new HttpError(400, "Pick a date and time.");
  const sendAt = new Date(Date.parse(`${b.sendAt}:00Z`) - 3600000).toISOString(); // typed as Abuja time
  if (b.id) {
    const p = await env.DB.prepare("SELECT status FROM lobby_posts WHERE id = ?").bind(Number(b.id)).first();
    if (!p) throw new HttpError(404, "That post is no longer there.");
    if (p.status === "sent") throw new HttpError(409, "That post has already gone out, so it can't be changed.");
    await env.DB.prepare("UPDATE lobby_posts SET audience = ?, body = ?, send_at = ?, status = 'scheduled', updated_at = ?, updated_by = ? WHERE id = ?").bind(audience, body, sendAt, now(), who, Number(b.id)).run();
  } else {
    await env.DB.prepare("INSERT INTO lobby_posts (audience, body, send_at, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?)").bind(audience, body, sendAt, now(), now(), who).run();
  }
  return lobbyAdmin(env);
}

export async function postAction(env, b, who) {
  const p = await env.DB.prepare("SELECT * FROM lobby_posts WHERE id = ?").bind(Number(b.id)).first();
  if (!p) throw new HttpError(404, "That post is no longer there.");
  if (p.status === "sent") throw new HttpError(409, "That post has already gone out.");
  if (b.action === "cancel") {
    await env.DB.prepare("UPDATE lobby_posts SET status = 'cancelled', updated_at = ?, updated_by = ? WHERE id = ?").bind(now(), who, p.id).run();
  } else if (b.action === "restore") {
    await env.DB.prepare("UPDATE lobby_posts SET status = 'scheduled', updated_at = ?, updated_by = ? WHERE id = ?").bind(now(), who, p.id).run();
  } else if (b.action === "send") {
    const st = await lobbyState(env);
    if (!st.open) throw new HttpError(409, "Open the lobby first.");
    if (fillPost(p.body, st) === null) throw new HttpError(409, "This post needs a link that isn't set yet. Add it above first.");
    await env.DB.prepare("UPDATE lobby_posts SET status = 'sent', sent_at = ?, notified = ?, updated_by = ? WHERE id = ?").bind(now(), quietHours() ? -1 : 0, who, p.id).run();
    await postPush(env, st);
  } else throw new HttpError(400, "Unknown action.");
  return lobbyAdmin(env);
}

export async function hideMessage(env, b, who) {
  const hide = !!b.hidden;
  await env.DB.prepare("UPDATE lobby_messages SET hidden = ?, hidden_by = ?, hidden_at = ? WHERE id = ?").bind(hide ? 1 : 0, hide ? who : null, hide ? now() : null, Number(b.id)).run();
  return lobbyAdmin(env);
}

// Resend the lobby email, or replace someone's link (the old one stops working).
export async function personAction(env, b, who) {
  const person = (await lobbyPeople(env)).find((p) => p.id === Number(b.ticketId));
  if (!person) throw new HttpError(404, "That person has no lobby place.");
  const st = await lobbyState(env);
  if (!st.open) throw new HttpError(409, "Open the lobby first.");
  if (b.action === "newlink") {
    await env.DB.prepare("UPDATE lobby_access SET revoked_at = ? WHERE ticket_id = ? AND revoked_at IS NULL").bind(now(), person.id).run();
    await env.DB.prepare("DELETE FROM push_subs WHERE ticket_id = ?").bind(person.id).run();
  } else if (b.action !== "resend") throw new HttpError(400, "Unknown action.");
  const a = await accessFor(env, person.id);
  if (b.action === "resend" || b.email) {
    if (!person.email) throw new HttpError(409, "This person has no email. Copy the link and share it by hand.");
    const ok = await sendMail(env, { to: person.email, ...mail.lobbyWelcome(first(person.name), lobbyUrl(env, a.token)) }, person.ref, "lobby_welcome");
    if (!ok) throw new HttpError(502, "The email did not send. Try again in a minute.");
    await env.DB.prepare("UPDATE lobby_access SET notified_at = ?, notified_by = 'welcome' WHERE id = ?").bind(now(), a.id).run();
  }
  return lobbyAdmin(env);
}
