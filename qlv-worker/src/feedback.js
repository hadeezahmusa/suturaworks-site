// Feedback after QLV 2026 (migrations/2026-11-08-feedback.sql).
//
// Everyone who took part gets a personal feedback link: sprinters in their
// certificate email, judges, mentors, the marshal and the desk in their
// thank-you, facilitators in an email of its own. The link is the key, so
// every answer is tied to the person's email without asking for it. A
// sprinter's certificate downloads only after their feedback is in.

import { HttpError, now, token, sendMail } from "./index.js";
import { tableName } from "./config.js";
import { staffPeople } from "./briefings.js";
import { dailyRoom } from "./mailer.js";
import * as mail from "./emails.js";

const SPRINTERS = ["standard", "member", "corporate", "sponsored", "partner"];
const ATTEND = ["yes", "maybe", "no"];
const SOCIALS = ["instagram", "linkedin", "x", "facebook", "tiktok"];
const ROLE_LABEL = { participant: "Participant", judge: "Judge", mentor: "Mentor/Advisor", both: "Judge and Mentor/Advisor", marshal: "Lead Sprint Marshal", desk: "Check-in desk", stage: "Stage Coordinator", facilitator: "Facilitator" };
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);

export const feedbackUrl = (env, tok) => `${env.SITE_URL}feedback.html?t=${tok}`;

// The person's row, made the first time it is needed. The token never
// changes, so a resent email carries the same link.
export async function ensureFeedback(env, p) {
  await env.DB.prepare(`INSERT INTO feedback (person_key, token, name, email, role, cert_ticket_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (person_key) DO UPDATE SET name = excluded.name, email = excluded.email, role = excluded.role, cert_ticket_id = COALESCE(excluded.cert_ticket_id, feedback.cert_ticket_id)`)
    .bind(p.key, token(24), p.name || null, p.email || null, p.role, p.certTicketId ?? null, now()).run();
  return env.DB.prepare("SELECT * FROM feedback WHERE person_key = ?").bind(p.key).first();
}

export async function markEmailed(env, key) {
  await env.DB.prepare("UPDATE feedback SET emailed_at = ? WHERE person_key = ?").bind(now(), key).run();
}

// For the certificate link: where to send someone whose feedback is not in.
export async function certificateGate(env, ticketId) {
  const row = await env.DB.prepare("SELECT token, submitted_at FROM feedback WHERE cert_ticket_id = ?").bind(ticketId).first();
  return row && !row.submitted_at ? feedbackUrl(env, row.token) : null;
}

async function rowByToken(env, t) {
  const tok = String(t || "");
  const row = tok.length >= 20 ? await env.DB.prepare("SELECT * FROM feedback WHERE token = ?").bind(tok).first() : null;
  if (!row) throw new HttpError(404, "This feedback link is not valid. Please use the link in your QLV 2026 email.");
  return row;
}

async function certificateLink(env, row) {
  if (!row.cert_ticket_id) return null;
  const c = await env.DB.prepare("SELECT token FROM certificates WHERE ticket_id = ? AND sent_at IS NOT NULL").bind(row.cert_ticket_id).first();
  return c ? `${env.WORKER_URL || "https://qlv2026.suturaworks.workers.dev"}/api/certificate?t=${c.token}` : null;
}

// ---------- the public page ----------

export async function feedbackPage(env, url) {
  const row = await rowByToken(env, url.searchParams.get("t"));
  if (!row.opened_at) await env.DB.prepare("UPDATE feedback SET opened_at = ? WHERE id = ?").bind(now(), row.id).run();
  return {
    first: String(row.name || "").trim().split(/\s+/)[0] || "",
    role: row.role, roleLabel: ROLE_LABEL[row.role] || "",
    hasCertificate: !!row.cert_ticket_id,
    submitted: !!row.submitted_at,
    certificate: row.submitted_at ? await certificateLink(env, row) : null,
  };
}

export async function submitFeedback(env, b) {
  const row = await rowByToken(env, b.t);
  if (row.submitted_at) return { ok: true, already: true, certificate: await certificateLink(env, row) };
  const a = b.answers || {};
  const overall = Number(a.overall), recommend = Number(a.recommend);
  if (!Number.isInteger(overall) || overall < 1 || overall > 5) throw new HttpError(400, "Choose how your overall experience was, from 1 to 5.");
  const expected = clean(a.expected, 2000), experienced = clean(a.experienced, 2000), nextTime = clean(a.next_time, 2000);
  if (expected.length < 2) throw new HttpError(400, "Tell us what you expected.");
  if (experienced.length < 2) throw new HttpError(400, "Tell us what you experienced.");
  if (nextTime.length < 2) throw new HttpError(400, "Tell us what you would like next time.");
  if (!Number.isInteger(recommend) || recommend < 0 || recommend > 10) throw new HttpError(400, "Choose how likely you are to recommend JCI Aso events, from 0 to 10.");
  if (!ATTEND.includes(a.attend_again)) throw new HttpError(400, "Tell us whether you will attend another JCI Aso programme.");
  if (![true, false].includes(a.membership_info)) throw new HttpError(400, "Tell us whether you would like information about JCI Aso membership.");
  if (![true, false].includes(a.event_emails)) throw new HttpError(400, "Tell us whether you would like emails about JCI Aso events.");
  const socials = {};
  for (const k of SOCIALS) { const v = clean(a.socials && a.socials[k], 100).replace(/\n/g, " "); if (v) socials[k] = v; }
  await env.DB.prepare(`UPDATE feedback SET submitted_at = ?, overall = ?, expected = ?, experienced = ?, next_time = ?, recommend = ?, attend_again = ?,
      membership_info = ?, event_emails = ?, socials = ? WHERE id = ? AND submitted_at IS NULL`)
    .bind(now(), overall, expected, experienced, nextTime, recommend, a.attend_again, a.membership_info ? 1 : 0, a.event_emails ? 1 : 0,
      Object.keys(socials).length ? JSON.stringify(socials) : null, row.id).run();
  return { ok: true, certificate: await certificateLink(env, row) };
}

// ---------- the Feedback tab ----------

// Everyone who took part on Saturday: checked-in sprinters, the people on the
// thank-you list who can be thanked, and the facilitators.
async function everyone(env) {
  const { thanksPeopleFor } = await import("./certs.js");
  const [spr, thanks, staff, checked] = await Promise.all([
    // Sponsored seats wait for the sponsor's payment, like their certificates.
    env.DB.prepare(`SELECT t.id, t.name, t.email, t.table_index FROM tickets t JOIN checkins c ON c.ticket_id = t.id JOIN registrations r ON r.ref = t.reg_ref
      WHERE NOT (r.tier = 'sponsored' AND r.status NOT IN ('verified', 'confirmed')) AND t.kind IN (${SPRINTERS.map(() => "?").join(", ")}) AND t.cancelled_at IS NULL AND t.ticket_ref != 'pending' AND t.sent_at IS NOT NULL
      ORDER BY t.name COLLATE NOCASE`).bind(...SPRINTERS).all().then((r) => r.results),
    thanksPeopleFor(env),
    staffPeople(env),
    env.DB.prepare("SELECT ticket_id FROM checkins").all().then((r) => new Set(r.results.map((x) => x.ticket_id))),
  ]);
  const out = spr.map((t) => ({ key: `c:${t.id}`, name: t.name, email: t.email, role: "participant", certTicketId: t.id, group: t.table_index === null ? "" : tableName(t.table_index), via: "certificate" }));
  for (const p of thanks) if (p.eligible) out.push({ key: p.key, name: p.name, email: p.email, role: p.role, group: "", via: "thanks" });
  for (const s of staff) if (s.kind === "facilitator" && checked.has(s.id)) out.push({ key: `f:${s.id}`, name: s.name, email: s.email, role: "facilitator", group: "", via: "own" });
  return out;
}

export async function feedbackAdmin(env) {
  const [people, rows] = await Promise.all([everyone(env), env.DB.prepare("SELECT * FROM feedback").all().then((r) => r.results)]);
  const by = Object.fromEntries(rows.map((r) => [r.person_key, r]));
  const list = people.map((p) => {
    const r = by[p.key] || {};
    return {
      key: p.key, name: p.name, email: p.email, role: p.role, roleLabel: ROLE_LABEL[p.role], group: p.group, via: p.via,
      link: r.token ? feedbackUrl(env, r.token) : null, emailedAt: r.emailed_at || null, openedAt: r.opened_at || null, submittedAt: r.submitted_at || null,
      answers: r.submitted_at ? {
        overall: r.overall, expected: r.expected, experienced: r.experienced, next_time: r.next_time, recommend: r.recommend,
        attend_again: r.attend_again, membership_info: !!r.membership_info, event_emails: !!r.event_emails, socials: r.socials ? JSON.parse(r.socials) : {},
      } : null,
    };
  });
  const done = list.filter((x) => x.answers).map((x) => x.answers);
  const n = done.length;
  const promoters = done.filter((a) => a.recommend >= 9).length, detractors = done.filter((a) => a.recommend <= 6).length;
  return {
    people: list,
    summary: {
      people: list.length, submitted: n,
      overall: n ? (done.reduce((s, a) => s + a.overall, 0) / n).toFixed(1) : null,
      recommend: n ? (done.reduce((s, a) => s + a.recommend, 0) / n).toFixed(1) : null,
      nps: n ? Math.round(((promoters - detractors) / n) * 100) : null,
      attend: Object.fromEntries(ATTEND.map((k) => [k, done.filter((a) => a.attend_again === k).length])),
      membership: done.filter((a) => a.membership_info).length,
      eventEmails: done.filter((a) => a.event_emails).length,
      socials: done.filter((a) => Object.keys(a.socials).length).length,
    },
  };
}

// The feedback link on its own, for people who get no certificate or
// thank-you from here (the facilitators), or a reminder for anyone.
export async function sendFeedbackEmails(env, b, who) {
  const { people } = await feedbackAdmin(env);
  const keys = new Set(Array.isArray(b.keys) ? b.keys : []);
  const pick = people.filter((p) => keys.has(p.key) && p.email && !p.submittedAt);
  if (!pick.length) throw new HttpError(409, "There is nobody to send to. People who have already answered are skipped.");
  const { room } = await dailyRoom(env);
  if (pick.length > room) throw new HttpError(409, `Only ${room} more emails can go today on the free plan. Send fewer, or the rest tomorrow.`);
  const all = await everyone(env);
  let sent = 0;
  for (const p of pick) {
    const person = all.find((x) => x.key === p.key);
    const row = await ensureFeedback(env, person);
    const reminder = !!p.emailedAt;
    const certificate = !!(await certificateLink(env, row));
    const ok = await sendMail(env, { to: p.email, ...mail.feedbackRequest({ first: String(p.name || "").split(" ")[0], link: feedbackUrl(env, row.token), reminder, certificate }) }, p.key, reminder ? "feedback_reminder" : "feedback_request");
    if (ok) { sent++; await markEmailed(env, p.key); }
  }
  return { sent, failed: pick.length - sent, ...(await feedbackAdmin(env)) };
}

// Each person's link, made now for anyone who has none yet, so admin can copy it.
export async function feedbackLink(env, b) {
  const person = (await everyone(env)).find((x) => x.key === b.key);
  if (!person) throw new HttpError(404, "That person is not on the feedback list.");
  const row = await ensureFeedback(env, person);
  return { link: feedbackUrl(env, row.token) };
}

export const FEEDBACK_COLS = ["name", "email", "role", "team", "submitted_at", "overall_1_to_5", "expected", "experienced", "next_time", "recommend_0_to_10",
  "attend_again", "membership_info", "event_emails", "instagram", "linkedin", "x", "facebook", "tiktok"];

export async function feedbackRows(env) {
  const { people } = await feedbackAdmin(env);
  return people.filter((p) => p.answers).map((p) => {
    const a = p.answers;
    return {
      name: p.name, email: p.email, role: p.roleLabel, team: p.group, submitted_at: p.submittedAt, overall_1_to_5: a.overall, expected: a.expected, experienced: a.experienced,
      next_time: a.next_time, recommend_0_to_10: a.recommend, attend_again: a.attend_again, membership_info: a.membership_info ? "yes" : "no", event_emails: a.event_emails ? "yes" : "no",
      ...Object.fromEntries(SOCIALS.map((k) => [k, a.socials[k] || ""])),
    };
  });
}

export const _test = { ROLE_LABEL };
