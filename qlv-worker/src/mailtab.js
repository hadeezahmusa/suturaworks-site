// The Email tab: admin writes an email to one or more people, with CC and
// attachments, and it goes from the portal address in the QLV look with no
// footer. Replies go to the usual reply-to address. Every send is logged.
// It shares the daily email allowance with the rest of the portal.

import { HttpError, now, sendMail } from "./index.js";
import { dailyRoom } from "./mailer.js";
import * as mail from "./emails.js";

const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;
const MAX_FILES = 6, MAX_BYTES = 8 * 1024 * 1024;
const TYPES = /^(application\/pdf|image\/(png|jpeg)|application\/vnd\.openxmlformats-officedocument\.(spreadsheetml\.sheet|wordprocessingml\.document|presentationml\.presentation)|text\/csv|application\/msword|application\/vnd\.ms-excel)$/;

// "a@x.com, b@y.com; c@z.com" or one per line, names allowed as "Ade <a@x.com>".
export function parseList(raw, label) {
  const items = String(raw || "").split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean)
    .map((x) => { const m = /<([^>]+)>/.exec(x); return (m ? m[1] : x).trim().toLowerCase(); });
  const bad = items.filter((x) => !EMAIL_RE.test(x));
  if (bad.length) throw new HttpError(400, `${label}: ${bad.slice(0, 3).join(", ")} ${bad.length === 1 ? "does" : "do"} not look like an email address.`);
  return [...new Set(items)];
}

export async function mailView(env) {
  const [{ sent24h, room }, sent] = await Promise.all([
    dailyRoom(env),
    env.DB.prepare("SELECT id, to_list, cc_list, subject, attachments, invoice_id, ok, sent_at, sent_by FROM mail_sent ORDER BY id DESC LIMIT 50").all().then((r) => r.results),
  ]);
  return {
    from: env.MAIL_FROM, replyTo: env.REPLY_TO, sent24h, room,
    sent: sent.map((m) => ({ ...m, to: JSON.parse(m.to_list), cc: JSON.parse(m.cc_list), attachments: JSON.parse(m.attachments) })),
  };
}

export async function sendCompose(env, b, who) {
  const to = parseList(b.to, "To");
  const cc = parseList(b.cc, "CC").filter((x) => !to.includes(x));
  if (!to.length) throw new HttpError(400, "Add at least one person in To.");
  if (to.length + cc.length > 30) throw new HttpError(400, "That is more than 30 people. Split it into smaller emails.");
  const subject = String(b.subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  if (!subject) throw new HttpError(400, "Add a subject.");
  const body = String(b.body || "").replace(/\r/g, "").trim().slice(0, 20000);
  if (!body) throw new HttpError(400, "Write the message.");
  const files = Array.isArray(b.attachments) ? b.attachments : [];
  if (files.length > MAX_FILES) throw new HttpError(400, `Attach at most ${MAX_FILES} files.`);
  let total = 0;
  const attachments = files.map((f) => {
    const name = String(f.name || "attachment").replace(/[\\/:*?"<>|\u0000-\u001F]/g, "").slice(0, 120) || "attachment";
    const type = String(f.type || "");
    if (!TYPES.test(type)) throw new HttpError(400, `${name}: attach PDFs, images, Word, Excel, PowerPoint or CSV files only.`);
    if (!/^[A-Za-z0-9+/=]+$/.test(String(f.content || ""))) throw new HttpError(400, `${name} did not come through. Attach it again.`);
    const size = Math.floor(String(f.content).length * 3 / 4);
    total += size;
    return { filename: name, content: f.content, content_type: type, size };
  });
  if (total > MAX_BYTES) throw new HttpError(413, "The attachments come to more than 8 MB. Send fewer or smaller files.");
  const { room } = await dailyRoom(env);
  if (to.length + cc.length > room) throw new HttpError(409, `Only ${room} more emails can go today on the free plan, and this one counts as ${to.length + cc.length}.`);
  let invoice = null;
  if (b.invoiceId) {
    const { invoiceReady } = await import("./invoices.js");
    invoice = await invoiceReady(env, Number(b.invoiceId));
  }
  const paragraphs = body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  const msg = mail.composed({ subject, paragraphs });
  msg.attachments = attachments.map(({ size, ...a }) => a);
  const ok = await sendMail(env, { to, cc, ...msg }, invoice ? invoice.ref : null, invoice ? "invoice" : "compose");
  const stamp = now();
  await env.DB.prepare(`INSERT INTO mail_sent (to_list, cc_list, subject, body, attachments, invoice_id, ok, detail, sent_at, sent_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(JSON.stringify(to), JSON.stringify(cc), subject, body, JSON.stringify(attachments.map((a) => ({ name: a.filename, size: a.size }))), invoice ? invoice.id : null, ok ? 1 : 0, null, stamp, who).run();
  if (!ok) throw new HttpError(502, "The email did not go. Nothing was sent. Try again in a minute.");
  if (invoice) await env.DB.prepare("UPDATE invoices SET emailed_at = COALESCE(emailed_at, ?) WHERE id = ?").bind(stamp, invoice.id).run();
  return { sent: true, to, cc, ...(await mailView(env)) };
}
