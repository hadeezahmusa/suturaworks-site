// Day one's Google Meet link by email (Friday 6 November, online at 4:00pm).
// Everyone who already has their ticket gets one email of their own;
// tickets sent on the day carry the link themselves (uploads.js), logged as
// ticket_meet, and are skipped here. One press sends to everyone left, and
// only when they all fit in today's email allowance.

import { HttpError } from "./index.js";
import { sendBatch, dailyRoom } from "./mailer.js";
import { lobbyState } from "./lobby.js";
import * as mail from "./emails.js";

const DAY_ONE_ENDS = Date.parse("2026-11-06T17:00:00Z");   // 6:00pm in Abuja
const KINDS = "('standard', 'member', 'corporate', 'sponsored', 'partner', 'adviser', 'judge')";

// The link to put in tickets sent today, or null outside day one.
export async function meetToday(env) {
  if (Date.now() > DAY_ONE_ENDS) return null;
  const st = await lobbyState(env);
  return st.meet_link || null;
}

async function recipients(env) {
  const [{ results: tickets }, { results: team }, { results: done }] = await env.DB.batch([
    env.DB.prepare(`SELECT name, email, kind FROM tickets WHERE kind IN ${KINDS} AND cancelled_at IS NULL AND sent_at IS NOT NULL AND email IS NOT NULL AND email != '' ORDER BY id`),
    env.DB.prepare("SELECT name, email FROM lobby_team WHERE marshal = 1 AND removed_at IS NULL"),
    env.DB.prepare("SELECT DISTINCT lower(recipient) AS e FROM email_log WHERE ok = 1 AND kind IN ('meet_link', 'ticket_meet')"),
  ]);
  const sent = new Set(done.map((r) => r.e));
  const seen = new Set(), todo = [];
  let already = 0;
  for (const p of tickets.map((t) => ({ ...t, staff: t.kind === "adviser" || t.kind === "judge" })).concat(team.map((t) => ({ ...t, staff: true })))) {
    const e = String(p.email).trim().toLowerCase();
    if (!e || seen.has(e)) continue;
    seen.add(e);
    if (sent.has(e)) { already++; continue; }
    todo.push({ ...p, email: e });
  }
  return { todo, already };
}

export async function meetMailView(env) {
  const [link, { todo, already }, { room, sent24h }] = await Promise.all([meetToday(env), recipients(env), dailyRoom(env)]);
  return { link, waiting: todo.length, already, room, sent24h, names: todo.map((p) => p.name), fits: todo.length <= room };
}

export async function sendMeetMail(env) {
  const link = await meetToday(env);
  if (!link) throw new HttpError(409, Date.now() > DAY_ONE_ENDS ? "Day one is over." : "Set the Google Meet link first, under Links and closing.");
  const { todo } = await recipients(env);
  if (!todo.length) throw new HttpError(409, "Everyone already has the Meet link.");
  const { room } = await dailyRoom(env);
  if (todo.length > room) throw new HttpError(409, `${todo.length} people need the link and only ${room} emails are left in today's allowance. Nothing was sent.`);
  const msgs = todo.map((p) => ({ ref: null, to: p.email, ...mail.meetLinkMail({ first: String(p.name).trim().split(/\s+/)[0], link, staff: p.staff }) }));
  for (let i = 0; i < msgs.length; i += 90) await sendBatch(env, msgs.slice(i, i + 90), "meet_link");
  return { sent: msgs.length, ...(await meetMailView(env)) };
}
