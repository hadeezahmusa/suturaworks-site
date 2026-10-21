// Money tab: what came in, what went out and what was given in kind, for the
// board and general assembly report. Admin only.
//
// Ticket income is read from registrations (verified or confirmed, so the
// money has been checked on the statement) and partnership income from
// confirmed partners. Neither is typed in twice. Spending, in-kind support
// and any other cash income are recorded by hand in the ledger table.
// Removed entries stay in the table with deleted_at set, and are never counted.

import { HttpError, now } from "./index.js";
import { PARTNER_LEVELS } from "./config.js";
import { sniff, stripMetadata } from "./strip.js";

const MAX_RECEIPT = 5 * 1024 * 1024;
const TICKET_TIERS = ["standard", "member", "corporate", "sponsored"];
const TICKET_LABEL = { standard: "Standard", member: "JCI Aso member", corporate: "Corporate team", sponsored: "Sponsored seats, bought for others" };

export const KINDS = { spend: "Spending", in_kind: "In-kind support", income: "Other income" };
export const COST_CATEGORIES = ["Venue and hall", "Food and drinks", "Printing and branding", "Publicity and media", "Speakers and facilitators",
  "Awards, gifts and souvenirs", "Sound, screens and equipment", "Registration and technology", "Transport and logistics", "Decoration",
  "Bank charges", "Refunds", "Other"];
export const INCOME_CATEGORIES = ["Donation", "Grant", "Sales", "Other"];
export const PARTY_TYPES = { member: "JCI Aso member", organisation: "Company or organisation", individual: "Individual", other: "Other" };
export const METHODS = { transfer: "Bank transfer", cash: "Cash", pos: "POS", card: "Card", other: "Other" };

const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

function naira(v) {
  const n = Number(String(v ?? "").replace(/[₦,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, "Enter an amount in naira, more than zero.");
  if (n > 1e9) throw new HttpError(400, "That amount looks too large. Check the number of zeros.");
  return Math.round(n);
}

// ---------- reading ----------

async function load(env) {
  const [tickets, pending, partners, entries] = await env.DB.batch([
    env.DB.prepare(`SELECT ref, tier, name, organisation, size, amount, verified_at, verified_by FROM registrations
      WHERE status IN ('verified', 'confirmed') AND amount > 0 AND tier IN ('standard', 'member', 'corporate', 'sponsored') ORDER BY verified_at, ref`),
    env.DB.prepare(`SELECT status, proof_at IS NOT NULL AS proof, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS amount FROM registrations
      WHERE status IN ('awaiting', 'queried') AND amount > 0 AND tier IN ('standard', 'member', 'corporate', 'sponsored') GROUP BY status, proof`),
    env.DB.prepare("SELECT id, reg_ref, name, level, amount, seats_total, status, confirmed_at, payment_note, created_by FROM partners ORDER BY COALESCE(confirmed_at, created_at)"),
    env.DB.prepare("SELECT * FROM ledger WHERE deleted_at IS NULL ORDER BY entry_date, id"),
  ]);
  return { tickets: tickets.results, pending: pending.results, partners: partners.results, entries: entries.results };
}

const sum = (rows, f = (r) => r.amount) => rows.reduce((n, r) => n + (Number(f(r)) || 0), 0);

export async function moneyView(env) {
  const d = await load(env);
  const byTier = TICKET_TIERS.map((tier) => {
    const rows = d.tickets.filter((r) => r.tier === tier);
    return { tier, label: TICKET_LABEL[tier], bookings: rows.length, seats: sum(rows, (r) => r.size), amount: sum(rows) };
  }).filter((t) => t.bookings);
  const paidPartners = d.partners.filter((p) => p.status === "confirmed");
  const waitingPartners = d.partners.filter((p) => p.status !== "confirmed");
  const income = d.entries.filter((e) => e.kind === "income");
  const spend = d.entries.filter((e) => e.kind === "spend");
  const paid = spend.filter((e) => e.status !== "owed"), owed = spend.filter((e) => e.status === "owed");
  const inKind = d.entries.filter((e) => e.kind === "in_kind");

  const cats = {};
  for (const e of [...spend, ...inKind]) {
    const c = (cats[e.category] ||= { category: e.category, paid: 0, owed: 0, inKind: 0 });
    if (e.kind === "in_kind") c.inKind += e.amount; else if (e.status === "owed") c.owed += e.amount; else c.paid += e.amount;
  }
  const byCategory = COST_CATEGORIES.filter((c) => cats[c]).map((c) => ({ ...cats[c], total: cats[c].paid + cats[c].owed + cats[c].inKind }));

  const t = {
    tickets: sum(d.tickets), partners: sum(paidPartners), other: sum(income),
    paid: sum(paid), owed: sum(owed), inKind: sum(inKind),
  };
  t.cashIn = t.tickets + t.partners + t.other;
  t.balance = t.cashIn - t.paid;
  t.afterOwed = t.balance - t.owed;
  t.fullCost = t.paid + t.owed + t.inKind;

  const pend = (status, proof) => d.pending.filter((r) => (status ? r.status === status : true) && (proof === undefined || !!r.proof === proof));
  return {
    totals: t,
    tickets: { byTier, bookings: d.tickets.length, seats: sum(d.tickets, (r) => r.size), amount: t.tickets },
    partners: paidPartners.map((p) => ({ name: p.name, level: PARTNER_LEVELS[p.level]?.name || p.level, amount: p.amount, seats: p.seats_total, confirmed_at: p.confirmed_at, note: p.payment_note })),
    expected: {
      proofIn: { n: sum(pend("awaiting", true), (r) => r.n), amount: sum(pend("awaiting", true)) },
      queried: { n: sum(pend("queried"), (r) => r.n), amount: sum(pend("queried")) },
      noProof: { n: sum(pend("awaiting", false), (r) => r.n), amount: sum(pend("awaiting", false)) },
      partners: { n: waitingPartners.length, amount: sum(waitingPartners), names: waitingPartners.map((p) => p.name) },
      owed: { n: owed.length, amount: t.owed },
    },
    byCategory,
    entries: d.entries.map(entryOut).reverse(),
    lists: { kinds: KINDS, cost: COST_CATEGORIES, income: INCOME_CATEGORIES, partyTypes: PARTY_TYPES, methods: METHODS },
  };
}

function entryOut(e) {
  return {
    id: e.id, kind: e.kind, date: e.entry_date, category: e.category, description: e.description, party: e.party || "", partyType: e.party_type || "",
    amount: e.amount, valueBasis: e.value_basis || "", status: e.status || "", method: e.method || "", paidFrom: e.paid_from || "",
    reference: e.reference || "", notes: e.notes || "", receipt: e.receipt_type ? { type: e.receipt_type, at: e.receipt_at } : null,
    createdBy: e.created_by, createdAt: e.created_at, updatedBy: e.updated_by || "", updatedAt: e.updated_at || "",
  };
}

// ---------- writing ----------

export async function saveEntry(env, b, who) {
  const kind = b.kind;
  if (!KINDS[kind]) throw new HttpError(400, "Choose spending, in-kind support or other income.");
  const date = clean(b.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new HttpError(400, "Enter the date it was paid, given or received.");
  const category = clean(b.category, 60);
  if (!(kind === "income" ? INCOME_CATEGORIES : COST_CATEGORIES).includes(category)) throw new HttpError(400, "Choose a category from the list.");
  const description = clean(b.description, 300);
  if (!description) throw new HttpError(400, kind === "in_kind" ? "Say what was given." : "Say what it was for.");
  const amount = naira(b.amount);
  const party = clean(b.party, 160) || null;
  if (kind === "in_kind" && !party) throw new HttpError(400, "Say who gave it, so they can be thanked in the report.");
  const partyType = kind !== "spend" && PARTY_TYPES[b.partyType] ? b.partyType : null;
  const status = kind === "spend" ? (b.status === "owed" ? "owed" : "paid") : null;
  const method = kind !== "in_kind" && METHODS[b.method] ? b.method : null;
  const v = {
    kind, entry_date: date, category, description, party, party_type: partyType, amount,
    value_basis: kind === "in_kind" ? clean(b.valueBasis, 300) || null : null,
    status, method,
    paid_from: kind === "spend" ? clean(b.paidFrom, 120) || null : null,
    reference: clean(b.reference, 120) || null,
    notes: clean(b.notes, 1000) || null,
  };
  const cols = Object.keys(v), vals = Object.values(v), stamp = now();
  if (b.id) {
    const r = await env.DB.prepare(`UPDATE ledger SET ${cols.map((c) => c + " = ?").join(", ")}, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`)
      .bind(...vals, stamp, who, Number(b.id)).run();
    if (!r.meta.changes) throw new HttpError(404, "That entry is no longer there. Refresh the page.");
    return { id: Number(b.id) };
  }
  const row = await env.DB.prepare(`INSERT INTO ledger (${cols.join(", ")}, created_at, created_by) VALUES (${cols.map(() => "?").join(", ")}, ?, ?) RETURNING id`)
    .bind(...vals, stamp, who).first();
  return { id: row.id };
}

export async function deleteEntry(env, b, who) {
  const r = await env.DB.prepare("UPDATE ledger SET deleted_at = ?, deleted_by = ? WHERE id = ? AND deleted_at IS NULL").bind(now(), who, Number(b.id)).run();
  if (!r.meta.changes) throw new HttpError(404, "That entry is no longer there. Refresh the page.");
  return { ok: true };
}

// Receipts and invoices: JPG, PNG or PDF, stored privately in KV like proofs
// of payment, with photo metadata (location, camera) stripped.
export async function putReceipt(env, req, id) {
  const e = await env.DB.prepare("SELECT id FROM ledger WHERE id = ? AND deleted_at IS NULL").bind(Number(id)).first();
  if (!e) throw new HttpError(404, "That entry is no longer there. Refresh the page.");
  if (Number(req.headers.get("content-length") || 0) > MAX_RECEIPT) throw new HttpError(413, "That file is over 5MB. Try a smaller photo or the PDF.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > MAX_RECEIPT) throw new HttpError(413, "That file is over 5MB. Try a smaller photo or the PDF.");
  if (!bytes.length) throw new HttpError(400, "That file is empty. Choose it again.");
  const type = sniff(bytes);
  if (!type) throw new HttpError(415, "Upload a JPG, PNG or PDF.");
  const stored = stripMetadata(bytes, type), stamp = now();
  await env.KV.put(`receipt:${e.id}`, stored, { metadata: { type, size: stored.length, at: stamp } });
  await env.DB.prepare("UPDATE ledger SET receipt_type = ?, receipt_size = ?, receipt_at = ? WHERE id = ?").bind(type, stored.length, stamp, e.id).run();
  return { ok: true };
}

export async function getReceipt(env, id) {
  const { value, metadata } = await env.KV.getWithMetadata(`receipt:${Number(id)}`, { type: "arrayBuffer" });
  if (!value) throw new HttpError(404, "No receipt uploaded.");
  const ext = metadata.type === "application/pdf" ? "pdf" : metadata.type === "image/png" ? "png" : "jpg";
  return new Response(value, {
    headers: { "content-type": metadata.type, "content-disposition": `inline; filename="qlv2026-receipt-${Number(id)}.${ext}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" },
  });
}

// ---------- export ----------

// One row per movement of money or support, ready to sort and total in a
// spreadsheet for the report. Amounts are plain numbers so they add up.
export const MONEY_COLS = ["Section", "Date", "Category", "Description", "From or to", "Contributor type", "Amount (NGN)", "Status",
  "Method", "Paid from", "Reference", "How the value was worked out", "Notes", "Receipt on file", "Recorded by"];

export async function moneyRows(env) {
  const d = await load(env);
  const rows = [];
  for (const r of d.tickets) rows.push({
    Section: "Income: ticket sales", Date: day(r.verified_at), Category: TICKET_LABEL[r.tier], Description: r.size + (r.size === 1 ? " seat" : " seats"),
    "From or to": r.organisation && r.tier !== "member" ? r.organisation : r.name, "Amount (NGN)": r.amount, Status: "Received", Method: "Bank transfer",
    Reference: r.ref, "Recorded by": r.verified_by || "",
  });
  for (const p of d.partners.filter((x) => x.status === "confirmed")) rows.push({
    Section: "Income: partnership", Date: day(p.confirmed_at), Category: PARTNER_LEVELS[p.level]?.name || p.level, Description: p.seats_total + (p.seats_total === 1 ? " seat" : " seats") + " included",
    "From or to": p.name, "Amount (NGN)": p.amount, Status: "Received", Reference: p.reg_ref || "", Notes: p.payment_note || "", "Recorded by": p.created_by || "",
  });
  const section = { income: "Income: other", spend: "Spending", in_kind: "In-kind support" };
  for (const kind of ["income", "spend", "in_kind"]) for (const e of d.entries.filter((x) => x.kind === kind)) rows.push({
    Section: section[kind], Date: e.entry_date, Category: e.category, Description: e.description, "From or to": e.party || "",
    "Contributor type": PARTY_TYPES[e.party_type] || "", "Amount (NGN)": e.amount,
    Status: kind === "in_kind" ? "Given" : kind === "income" ? "Received" : e.status === "owed" ? "Owed" : "Paid",
    Method: METHODS[e.method] || "", "Paid from": e.paid_from || "", Reference: e.reference || "", "How the value was worked out": e.value_basis || "",
    Notes: e.notes || "", "Receipt on file": e.receipt_type ? "Yes" : "No", "Recorded by": e.updated_by || e.created_by,
  });
  return rows;
}
