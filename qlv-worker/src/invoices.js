// Invoices (QLV-2026-Invoices-Build-Spec.md, narrowed by the Chair to making
// and sending them): admin raises an invoice for an organisation, downloads
// it as a PDF or emails it from the Email tab. No reconciliation: marking
// paid, the money summary and bookings stay as they are. The PDF is drawn in
// the admin's browser (qlv2026/invoice.js), like the certificates.

import { HttpError, now } from "./index.js";

const SETTINGS_KEY = "inv:settings";
const SIG = { treasurer: "inv:sig:treasurer", signatory: "inv:sig:signatory" };
export const INVOICE_DEFAULTS = {
  bankName: "First City Monument Bank (FCMB)", accountName: "", accountNumber: "", paymentsEmail: "",
  treasurerName: "JCIN Amb. Dunsin Kolade", treasurerTitle: "2026 Local Organization Treasurer, JCI Aso",
  signatoryName: "Hadeezah Balarabe Musa", signatoryTitle: "2026 Chairperson, Quality Leadership Value, JCI Aso",
  defaultDue: "2026-11-06", nextNumber: 20,
};
const SAME = "Full access to both days: the virtual session and the in-person leadership sprint";
export const CATALOGUE = {
  sponsored: { title: "Sponsored seats, QLV 2026", unit: 9500, description: SAME, seatsEach: 1, min: 6 },
  standard: { title: "Standard seats, QLV 2026", unit: 10000, description: SAME, seatsEach: 1 },
  member: { title: "JCI Aso member seats, QLV 2026", unit: 8000, description: SAME, seatsEach: 1 },
  corporate3: { title: "Corporate team, 3 seats", unit: 40000, description: "Three seats for one organisation, both days", seatsEach: 3 },
  corporate5: { title: "Corporate team, 5 seats", unit: 60000, description: "Five seats for one organisation, both days", seatsEach: 5 },
  lead: { title: "Lead Sponsor, QLV 2026", unit: 200000, description: "Lead sponsorship of QLV 2026, including 4 seats", seatsEach: 4 },
  supporting: { title: "Supporting Sponsor, QLV 2026", unit: 100000, description: "Supporting sponsorship of QLV 2026, including 2 seats", seatsEach: 2 },
  community: { title: "Community Sponsor, QLV 2026", unit: 50000, description: "Community sponsorship of QLV 2026, including 1 seat", seatsEach: 1 },
  custom: { title: "", unit: 0, description: "", seatsEach: 0 },
};
const clean = (v, max = 160) => String(v ?? "").replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const invoiceNo = (n) => "QLV " + String(n).padStart(4, "0");

export async function invoiceSettings(env) {
  return { ...INVOICE_DEFAULTS, ...((await env.KV.get(SETTINGS_KEY, "json")) || {}) };
}
async function signatures(env) {
  const [t, s] = await Promise.all([env.KV.getWithMetadata(SIG.treasurer), env.KV.getWithMetadata(SIG.signatory)]);
  return { treasurer: t.value ? t.metadata : null, signatory: s.value ? s.metadata : null };
}
// What is still needed before an invoice can be emailed.
function missing(s) {
  const out = [];
  if (!s.bankName) out.push("bank name");
  if (!s.accountName) out.push("account name");
  if (!s.accountNumber) out.push("account number");
  if (!s.paymentsEmail) out.push("payments email");
  return out;
}

function shape(r) {
  return {
    id: r.id, number: r.number, no: invoiceNo(r.number), status: r.cancelled_at ? "cancelled" : r.emailed_at ? "sent" : "draft",
    bill: { org: r.bill_org, contact: r.bill_contact || "", title: r.bill_title || "", address: r.bill_address || "", email: r.bill_email || "", phone: r.bill_phone || "" },
    issueDate: r.issue_date, dueDate: r.due_date, lines: JSON.parse(r.lines), subtotal: r.subtotal, total: r.total, seats: r.seats,
    createdAt: r.created_at, createdBy: r.created_by, emailedAt: r.emailed_at, cancelledAt: r.cancelled_at, copiedFrom: r.copied_from,
  };
}

export async function invoicesView(env) {
  const [{ results }, s, sigs] = await Promise.all([
    env.DB.prepare("SELECT * FROM invoices ORDER BY number DESC").all(), invoiceSettings(env), signatures(env),
  ]);
  return { invoices: results.map(shape), settings: s, signatures: sigs, missing: missing(s), catalogue: CATALOGUE };
}

// Lines from the form, priced and checked. Admin may change a price.
function buildLines(raw) {
  if (Array.isArray(raw) && raw.length > 4) throw new HttpError(400, "An invoice holds up to four lines, so it fits on one page.");
  const lines = (Array.isArray(raw) ? raw : []).map((l, i) => {
    const item = CATALOGUE[l.item] ? l.item : null;
    if (!item) throw new HttpError(400, `Line ${i + 1}: choose an item.`);
    const c = CATALOGUE[item];
    const qty = Math.floor(Number(l.qty));
    if (!(qty >= 1 && qty <= 10000)) throw new HttpError(400, `Line ${i + 1}: the quantity must be at least 1.`);
    if (c.min && qty < c.min) throw new HttpError(400, `Sponsored seats start at ${c.min}. Line ${i + 1} has ${qty}.`);
    const unit = Math.round(Number(l.unit));
    if (!(unit >= 0 && unit <= 100000000)) throw new HttpError(400, `Line ${i + 1}: check the unit price.`);
    const title = clean(l.title, 120) || c.title;
    if (!title) throw new HttpError(400, `Line ${i + 1}: give the custom line a description.`);
    return { item, title, description: clean(l.description, 200) || (item === "custom" ? "" : c.description), qty, unit, amount: qty * unit, seats: qty * c.seatsEach };
  });
  if (!lines.length) throw new HttpError(400, "Add at least one line.");
  return lines;
}

export async function saveInvoice(env, b, who) {
  const bill = {
    org: clean(b.bill?.org, 160), contact: clean(b.bill?.contact, 120), title: clean(b.bill?.title, 120),
    address: clean(b.bill?.address, 240), email: clean(b.bill?.email, 160).toLowerCase(), phone: clean(b.bill?.phone, 40),
  };
  if (!bill.org) throw new HttpError(400, "Enter the organisation the invoice is for.");
  if (bill.email && !EMAIL_RE.test(bill.email)) throw new HttpError(400, "The bill-to email does not look complete.");
  const s = await invoiceSettings(env);
  const issue = DATE_RE.test(b.issueDate || "") ? b.issueDate : new Date().toISOString().slice(0, 10);
  const due = DATE_RE.test(b.dueDate || "") ? b.dueDate : s.defaultDue;
  if (due < issue) throw new HttpError(400, "The due date is before the issue date.");
  const lines = buildLines(b.lines);
  const subtotal = lines.reduce((n, l) => n + l.amount, 0), seats = lines.reduce((n, l) => n + l.seats, 0);
  const stamp = now();
  const vals = [bill.org, bill.contact || null, bill.title || null, bill.address || null, bill.email || null, bill.phone || null, issue, due, JSON.stringify(lines), subtotal, subtotal, seats];
  if (b.id) {
    const cur = await env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(Number(b.id)).first();
    if (!cur) throw new HttpError(404, "That invoice is not there. Refresh the page.");
    await env.DB.prepare(`UPDATE invoices SET bill_org = ?, bill_contact = ?, bill_title = ?, bill_address = ?, bill_email = ?, bill_phone = ?, issue_date = ?, due_date = ?,
      lines = ?, subtotal = ?, total = ?, seats = ?, updated_at = ? WHERE id = ?`).bind(...vals, stamp, cur.id).run();
    return { id: cur.id, ...(await invoicesView(env)) };
  }
  // Numbers run on from the highest given, or the setting if that is higher. Never reused.
  for (let i = 0; i < 5; i++) {
    const top = await env.DB.prepare("SELECT MAX(number) AS n FROM invoices").first();
    const high = Number(await env.KV.get("inv:high")) || 0;
    const number = Math.max((top && top.n) || 0, high, Number(s.nextNumber) - 1) + 1;
    try {
      const row = await env.DB.prepare(`INSERT INTO invoices (number, bill_org, bill_contact, bill_title, bill_address, bill_email, bill_phone, issue_date, due_date, lines, subtotal, total, seats,
        created_at, created_by, updated_at, copied_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
        .bind(number, ...vals, stamp, who, stamp, b.copiedFrom ? Number(b.copiedFrom) : null).first();
      return { id: row.id, ...(await invoicesView(env)) };
    } catch (err) {
      if (!/UNIQUE/i.test(String(err))) throw err;
    }
  }
  throw new HttpError(500, "Could not number the invoice. Try again.");
}

export async function deleteInvoice(env, b) {
  // A number that went out by email is never given again; an unsent one can be.
  const cur = await env.DB.prepare("SELECT number, emailed_at FROM invoices WHERE id = ?").bind(Number(b.id)).first();
  const high = Number(await env.KV.get("inv:high")) || 0;
  if (cur && cur.emailed_at && cur.number > high) await env.KV.put("inv:high", String(cur.number));
  const r = await env.DB.prepare("DELETE FROM invoices WHERE id = ?").bind(Number(b.id)).run();
  if (!r.meta.changes) throw new HttpError(404, "That invoice is not there. Refresh the page.");
  return invoicesView(env);
}

export async function cancelInvoice(env, b, who) {
  const r = await env.DB.prepare("UPDATE invoices SET cancelled_at = ?, cancelled_by = ? WHERE id = ? AND cancelled_at IS NULL").bind(now(), who, Number(b.id)).run();
  if (!r.meta.changes) throw new HttpError(409, "That invoice is already cancelled.");
  return invoicesView(env);
}

export async function saveInvoiceSettings(env, b) {
  const cur = await invoiceSettings(env);
  const next = { ...cur };
  for (const k of ["bankName", "accountName", "accountNumber", "paymentsEmail", "treasurerName", "treasurerTitle", "signatoryName", "signatoryTitle"]) if (k in b) next[k] = clean(b[k], 160);
  if (next.paymentsEmail && !EMAIL_RE.test(next.paymentsEmail)) throw new HttpError(400, "The payments email does not look complete.");
  if (next.accountNumber && !/^[0-9 -]{6,20}$/.test(next.accountNumber)) throw new HttpError(400, "The account number should be digits only.");
  if ("defaultDue" in b) { if (!DATE_RE.test(b.defaultDue)) throw new HttpError(400, "Choose a default due date."); next.defaultDue = b.defaultDue; }
  if ("nextNumber" in b) {
    const n = Math.floor(Number(b.nextNumber));
    const top = await env.DB.prepare("SELECT MAX(number) AS n FROM invoices").first();
    if (!(n >= 1 && n <= 9999)) throw new HttpError(400, "The next number must be between 1 and 9999.");
    if (top && top.n && n <= top.n) throw new HttpError(400, `${invoiceNo(top.n)} already exists, so the next number must be higher.`);
    next.nextNumber = n;
  }
  await env.KV.put(SETTINGS_KEY, JSON.stringify(next));
  return invoicesView(env);
}

export async function saveInvoiceSignature(env, b, who) {
  const key = SIG[b.who];
  if (!key) throw new HttpError(400, "Choose whose signature this is.");
  if (b.remove) { await env.KV.delete(key); return invoicesView(env); }
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image || ""));
  if (!m) throw new HttpError(400, "Upload the signature as a PNG file.");
  const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
  if (bytes.length > 1500000) throw new HttpError(413, "That image is over 1.5 MB. Save a smaller PNG.");
  if (!(bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)) throw new HttpError(400, "That file is not a PNG.");
  await env.KV.put(key, bytes, { metadata: { at: now(), by: who, size: bytes.length } });
  return invoicesView(env);
}

export async function invoiceSignatureImages(env) {
  const [t, s] = await Promise.all([env.KV.get(SIG.treasurer, "arrayBuffer"), env.KV.get(SIG.signatory, "arrayBuffer")]);
  // In chunks: spreading a large image into one call overflows the stack.
  const url = (buf) => {
    if (!buf) return null;
    const b = new Uint8Array(buf); let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return "data:image/png;base64," + btoa(s);
  };
  return { treasurer: url(t), signatory: url(s) };
}

// For the Email tab: an invoice may go only with the bank details filled in.
export async function invoiceReady(env, id) {
  const r = await env.DB.prepare("SELECT * FROM invoices WHERE id = ?").bind(id).first();
  if (!r) throw new HttpError(404, "That invoice is not there.");
  if (r.cancelled_at) throw new HttpError(409, `${invoiceNo(r.number)} is cancelled.`);
  const m = missing(await invoiceSettings(env));
  if (m.length) throw new HttpError(409, `Add the ${m.join(", ")} on the Invoices tab before sending an invoice.`);
  return { id: r.id, ref: invoiceNo(r.number) };
}
