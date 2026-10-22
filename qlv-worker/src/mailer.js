// Sending many emails at once on Resend's free plan (100 a day, 3,000 a
// month). Shared by the code reminders, the answers reminder and the role packs.

import { HttpError, now, token } from "./index.js";

// The most emails any batch lets the last 24 hours reach, leaving room for
// tickets sent the same day.
export const DAILY_SAFE = 90;

// Sends a list of {ref, to, subject, html, text} as one Resend batch and logs
// it with one insert, so a batch of any size stays inside Cloudflare's
// per-request limits. All or nothing: if Resend refuses, nobody is logged as
// sent and the same people are picked up next time.
export async function sendBatch(env, msgs, kind) {
  let ok = false;
  let detail = "";
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify(msgs.map((m) => ({ from: env.MAIL_FROM, to: [m.to], reply_to: env.REPLY_TO, subject: m.subject, html: m.html, text: m.text }))),
      });
      ok = res.ok;
      detail = (await res.text()).slice(0, 300);
    } catch (err) {
      detail = String(err).slice(0, 300);
    }
  } else {
    for (const m of msgs) await env.KV.put(`outbox:${Date.now()}:${token(6)}`, JSON.stringify({ kind, ...m }), { expirationTtl: 86400 });
    ok = true;
    detail = "dev outbox";
  }
  await env.DB.prepare(`INSERT INTO email_log (ref, kind, recipient, ok, detail, created_at)
      SELECT json_extract(value, '$.ref'), ?, json_extract(value, '$.to'), ?, ?, ? FROM json_each(?)`)
    .bind(kind, ok ? 1 : 0, ok ? "batch" : detail, now(), JSON.stringify(msgs.map((m) => ({ ref: m.ref, to: m.to })))).run();
  if (!ok) throw new HttpError(502, "Resend did not accept the batch, so nobody was emailed. Try again in a few minutes.");
}

// Emails sent in the last 24 hours, and how many a batch may add without
// passing the free plan's safe daily figure.
export async function dailyRoom(env) {
  const since = new Date(Date.now() - 86400000).toISOString();
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM email_log WHERE ok = 1 AND created_at > ?").bind(since).first();
  return { sent24h: n, room: Math.max(0, DAILY_SAFE - n) };
}

