// Money tab: markup, styles and browser code. Admin only. Uses the helpers
// from the main admin script ($, esc, call, msg, when, naira).

export const MONEY_STYLE = String.raw`
#moneyView h3{font-size:12px;margin:14px 0 6px;color:var(--body)}
#moneyView table.sum tbody tr{cursor:default}#moneyView table.sum tbody tr:hover{background:none}
#moneyView td.n,#moneyView th.n{text-align:right;white-space:nowrap}
#moneyView tr.tot td{font-weight:700;border-top:2px solid var(--rule)}
.tile small{display:block;font-size:11px;color:var(--mute);margin-top:2px}.tile.gold small{color:var(--ink)}
.seg{display:flex;gap:6px;margin:0 0 6px;flex-wrap:wrap}.seg button{flex:1 1 auto;font:inherit;font-size:12px;font-weight:600;padding:9px 8px;border-radius:7px;border:1px solid var(--rule);background:#fff;color:var(--body);cursor:pointer}
.seg button.on{background:var(--navy);border-color:var(--navy);color:#fff}
#mForm input:not([type=file]),#mForm textarea{width:100%;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:10px 12px;min-height:42px;background:#fff}
#mForm textarea{min-height:70px}#mForm [hidden]{display:none!important}#mForm input[type=file]{margin-top:6px;font-size:12px;max-width:100%}
.pill.kind{background:#EDE6F6;color:#4B2C7A}
.exp div{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid var(--line);font-size:12px}.exp div:first-child{border-top:0}
.printhead{display:none}#moneyView .btn.phone{display:none}
@media (max-width:760px){#moneyView .btn.phone{display:inline-flex}#moneyView .side{position:static}}
@media print{
  body{background:#fff;font-size:11px}.top,.tabs,#msg,.wrap>.card,.noprint{display:none!important}
  .wrap{padding:0;max-width:none}.printhead{display:block;font-weight:700;font-size:15px;margin:0 0 12px}
  #moneyView .grid{display:block}#moneyView .card{break-inside:avoid;border-color:#bbb;margin:0 0 12px}
  .tiles{grid-template-columns:repeat(3,1fr)}.tile{border-color:#bbb}
}
`;

export const MONEY_HTML = String.raw`
<div id="moneyView" hidden>
  <div class="printhead">JCI Aso · QLV 2026 · Money summary · <span id="mPrinted"></span></div>
  <div class="noprint" style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px;margin:0 0 12px">
    <p class="small" style="margin:0;max-width:640px">Ticket sales and partnerships are counted automatically once a payment is verified or a partner is confirmed. Record spending, in-kind support and any other income here. Only admin sees this page.</p>
    <div class="actions" style="margin:0"><a class="btn phone" href="#mForm" style="text-decoration:none;align-items:center">Record an entry</a><a class="btn ghost" href="/admin/export/money.csv" style="text-decoration:none;display:inline-flex;align-items:center">Download money CSV</a><button class="btn ghost" data-mprint="1">Print summary</button></div>
  </div>
  <div class="tiles" id="mTiles"></div>
  <div class="grid">
    <div class="list" style="flex:3 1 600px">
      <div class="card" style="margin:0 0 14px"><h2>Income</h2>
        <h3>Ticket sales</h3><table class="sum"><thead><tr><th>Ticket type</th><th class="n">Bookings</th><th class="n">Seats</th><th class="n">Amount</th></tr></thead><tbody id="mTickets"></tbody></table>
        <h3>Partnerships</h3><table class="sum"><thead><tr><th>Partner</th><th>Level</th><th class="n">Confirmed</th><th class="n">Amount</th></tr></thead><tbody id="mPartners"></tbody></table>
        <h3>Other income</h3><table class="sum"><tbody id="mOther"></tbody></table>
      </div>
      <div class="card" style="margin:0 0 14px"><h2>Expected, not yet counted</h2><div class="exp" id="mExpected"></div></div>
      <div class="card" style="margin:0 0 14px;overflow-x:auto"><h2>Cost by category</h2>
        <table class="sum"><thead><tr><th>Category</th><th class="n">Paid</th><th class="n">Owed</th><th class="n">In-kind</th><th class="n">Full cost</th></tr></thead><tbody id="mCats"></tbody></table>
        <p class="small" style="margin:8px 0 0">Full cost counts in-kind support at its estimated value, so the report shows what the event really took to run.</p></div>
      <div class="card" style="padding:0;overflow-x:auto"><div style="padding:14px 16px 0"><h2>Spending, in-kind support and other income</h2><div class="chips noprint" id="mChips"></div></div>
        <table><thead><tr><th>Date</th><th>Type</th><th class="hide-s">Category</th><th>Details</th><th class="n">Amount</th><th>Receipt</th></tr></thead><tbody id="mRows"></tbody></table></div>
    </div>
    <div class="side noprint" style="flex:1 1 340px">
      <form class="card" id="mForm" novalidate><h2 id="mTitle">Record an entry</h2>
        <div class="seg" id="mKinds"><button type="button" data-mkind="spend">Spending</button><button type="button" data-mkind="in_kind">In-kind</button><button type="button" data-mkind="income">Other income</button></div>
        <p class="small" id="mHelp" style="margin:0 0 12px"></p>
        <input type="hidden" name="entryId">
        <label class="fl">Date<input type="date" name="date" min="2026-01-01" max="2027-12-31" required></label>
        <label class="fl">Category<select name="category"></select></label>
        <label class="fl"><span id="lDesc"></span><input type="text" name="description" maxlength="300" required></label>
        <label class="fl"><span id="lParty"></span><input type="text" name="party" maxlength="160"></label>
        <label class="fl" data-for="in_kind income">Who they are<select name="partyType"><option value="">Choose</option></select></label>
        <label class="fl"><span id="lAmount"></span><input type="text" inputmode="numeric" name="amount" placeholder="For example 45000" required></label>
        <label class="fl" data-for="in_kind">How the value was worked out<input type="text" name="valueBasis" maxlength="300" placeholder="For example the printer's quote, or what it would have cost us"></label>
        <label class="fl" data-for="spend">Paid yet?<select name="status"><option value="paid">Yes, paid</option><option value="owed">Not yet, still owed</option></select></label>
        <label class="fl" data-for="spend income">How it was paid<select name="method"><option value="">Choose</option></select></label>
        <label class="fl" data-for="spend">Paid from<input type="text" name="paidFrom" list="mFrom" maxlength="120" placeholder="For example JCI Aso account"></label>
        <datalist id="mFrom"><option value="JCI Aso account"><option value="Petty cash"><option value="Paid by a member, to be reimbursed"></datalist>
        <label class="fl">Reference<input type="text" name="reference" maxlength="120" placeholder="Transfer reference, invoice or receipt number"></label>
        <label class="fl">Notes<textarea name="notes" maxlength="1000"></textarea></label>
        <label class="fl">Receipt or invoice, if you have one<input type="file" name="receipt" accept="image/jpeg,image/png,application/pdf"><span class="small" style="display:block;font-weight:400">JPG, PNG or PDF, up to 5MB.</span></label>
        <p class="small" id="mReceiptNow" style="margin:0 0 10px"></p>
        <button class="btn" style="width:100%" id="mSave">Save entry</button>
        <div class="actions" id="mEditing" hidden><button type="button" class="btn ghost" data-mcancel="1">Cancel edit</button><button type="button" class="btn warn" data-mdelete="1">Remove entry</button></div>
        <p class="small" id="mStamp" style="margin:6px 0 0"></p>
      </form>
    </div>
  </div>
</div>`;

export const MONEY_JS = String.raw`
let mKind = "spend", mData = null, mFilter = "all", mReady = false;
const M_HELP = {
  spend: "Money paid out for the event, or a bill still to pay.",
  in_kind: "Something given instead of money, like printed flyers or hosting the registration. No cash moves, but it counts towards the full cost and the thank-yous in the report.",
  income: "Cash received that is not a ticket or a partnership, such as a donation. Tickets and partnerships are already counted.",
};
const M_LABELS = { spend: ["What it was for", "Paid to", "Amount (₦)"], in_kind: ["What was given", "Given by", "Estimated value (₦)"], income: ["What it was", "Received from", "Amount (₦)"] };
const mNaira = (n) => (n < 0 ? "-" : "") + naira(Math.abs(n));
const mDate = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

function mOptions(sel, entries, keep) {
  sel.innerHTML = (keep ? '<option value="">Choose</option>' : "") + entries.map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + "</option>").join("");
}
function setKind(kind) {
  mKind = kind;
  const f = $("#mForm"), L = mData.lists;
  document.querySelectorAll("[data-mkind]").forEach((b) => { b.classList.toggle("on", b.dataset.mkind === kind); b.setAttribute("aria-pressed", b.dataset.mkind === kind); });
  $("#mHelp").textContent = M_HELP[kind];
  [$("#lDesc").textContent, $("#lParty").textContent, $("#lAmount").textContent] = M_LABELS[kind];
  const cats = kind === "income" ? L.income : L.cost;
  const was = f.category.value;
  mOptions(f.category, cats.map((c) => [c, c]));
  if (cats.includes(was)) f.category.value = was;
  f.querySelectorAll("[data-for]").forEach((el) => { el.hidden = !el.dataset.for.split(" ").includes(kind); });
}

async function loadMoney() {
  const d = mData = await call("money");
  const t = d.totals, f = $("#mForm");
  if (!mReady) {
    mReady = true;
    mOptions(f.method, Object.entries(d.lists.methods), true);
    mOptions(f.partyType, Object.entries(d.lists.partyTypes), true);
    setKind(mKind);
    if (!f.date.value) f.date.value = new Date(Date.now() + 3600000).toISOString().slice(0, 10);
  }
  const inKindCount = d.entries.filter((e) => e.kind === "in_kind").length;
  const tile = (label, value, sub, cls) => '<div class="tile' + (cls ? " " + cls : "") + '"><span>' + label + "</span><b>" + value + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>";
  $("#mTiles").innerHTML =
    tile("Cash received", mNaira(t.cashIn), "Tickets " + mNaira(t.tickets) + " · Partnerships " + mNaira(t.partners) + (t.other ? " · Other " + mNaira(t.other) : "")) +
    tile("Cash spent", mNaira(t.paid)) +
    tile("Cash in hand", mNaira(t.balance), t.owed ? "After bills still owed: " + mNaira(t.afterOwed) : "Received less spent") +
    tile("Still owed", mNaira(t.owed), plural(d.expected.owed.n, "bill", "bills") + " to pay") +
    tile("In-kind support", mNaira(t.inKind), "Estimated value, " + plural(inKindCount, "item", "items")) +
    tile("Full cost of the event", mNaira(t.fullCost), "Spent, owed and in-kind together", "gold");

  const k = d.tickets;
  $("#mTickets").innerHTML = (k.byTier.map((r) => "<tr><td>" + esc(r.label) + '</td><td class="n">' + r.bookings + '</td><td class="n">' + r.seats + '</td><td class="n">' + mNaira(r.amount) + "</td></tr>").join("") ||
    '<tr><td colspan="4" class="small">No verified ticket payments yet.</td></tr>') +
    '<tr class="tot"><td>Ticket sales</td><td class="n">' + k.bookings + '</td><td class="n">' + k.seats + '</td><td class="n">' + mNaira(k.amount) + "</td></tr>";
  $("#mPartners").innerHTML = (d.partners.map((p) => "<tr><td>" + esc(p.name) + "</td><td>" + esc(p.level) + '</td><td class="n">' + esc(when(p.confirmed_at)) + '</td><td class="n">' + mNaira(p.amount) + "</td></tr>").join("") ||
    '<tr><td colspan="4" class="small">No confirmed partners yet.</td></tr>') +
    '<tr class="tot"><td colspan="3">Partnerships</td><td class="n">' + mNaira(t.partners) + "</td></tr>";
  const other = d.entries.filter((e) => e.kind === "income");
  $("#mOther").innerHTML = (other.map((e) => "<tr><td>" + esc(e.description) + (e.party ? '<div class="small">From ' + esc(e.party) + "</div>" : "") + '</td><td class="n">' + mNaira(e.amount) + "</td></tr>").join("") ||
    '<tr><td colspan="2" class="small">None recorded.</td></tr>') + (other.length ? '<tr class="tot"><td>Other income</td><td class="n">' + mNaira(t.other) + "</td></tr>" : "");

  const x = d.expected, lines = [];
  if (x.proofIn.n) lines.push([plural(x.proofIn.n, "booking", "bookings") + " with proof uploaded, waiting to be checked", x.proofIn.amount]);
  if (x.queried.n) lines.push([plural(x.queried.n, "booking", "bookings") + " queried", x.queried.amount]);
  if (x.noProof.n) lines.push([plural(x.noProof.n, "booking", "bookings") + " with no proof of payment yet", x.noProof.amount]);
  if (x.partners.n) lines.push([plural(x.partners.n, "partner", "partners") + " awaiting payment: " + x.partners.names.join(", "), x.partners.amount]);
  if (x.owed.n) lines.push([plural(x.owed.n, "bill", "bills") + " still to pay", -x.owed.amount]);
  $("#mExpected").innerHTML = lines.length ? lines.map(([a, b]) => "<div><span>" + esc(a) + "</span><b>" + mNaira(b) + "</b></div>").join("") : '<p class="small" style="margin:0">Nothing outstanding.</p>';

  const c = d.byCategory, sumOf = (key) => c.reduce((n, r) => n + r[key], 0);
  $("#mCats").innerHTML = (c.map((r) => "<tr><td>" + esc(r.category) + '</td><td class="n">' + mNaira(r.paid) + '</td><td class="n">' + mNaira(r.owed) + '</td><td class="n">' + mNaira(r.inKind) + '</td><td class="n"><b>' + mNaira(r.total) + "</b></td></tr>").join("") ||
    '<tr><td colspan="5" class="small">No spending or in-kind support recorded yet.</td></tr>') +
    (c.length ? '<tr class="tot"><td>Total</td><td class="n">' + mNaira(sumOf("paid")) + '</td><td class="n">' + mNaira(sumOf("owed")) + '</td><td class="n">' + mNaira(sumOf("inKind")) + '</td><td class="n">' + mNaira(sumOf("total")) + "</td></tr>" : "");
  drawEntries();
}

function drawEntries() {
  const d = mData, count = (k) => d.entries.filter((e) => k === "all" || e.kind === k).length;
  const labels = { all: "All", spend: "Spending", in_kind: "In-kind", income: "Other income" };
  $("#mChips").innerHTML = Object.keys(labels).map((k) => '<button data-mf="' + k + '" class="' + (k === mFilter ? "on" : "") + '">' + labels[k] + " (" + count(k) + ")</button>").join("");
  const pill = (e) => e.kind === "in_kind" ? '<span class="pill kind">In-kind</span>' : e.kind === "income" ? '<span class="pill ok">Income</span>' : e.status === "owed" ? '<span class="pill wait">Owed</span>' : '<span class="pill off">Paid</span>';
  const who = (e) => !e.party ? "" : (e.kind === "spend" ? "Paid to " : e.kind === "in_kind" ? "Given by " : "From ") + esc(e.party) + (e.partyType ? " (" + esc(d.lists.partyTypes[e.partyType]) + ")" : "");
  const rows = d.entries.filter((e) => mFilter === "all" || e.kind === mFilter);
  $("#mRows").innerHTML = rows.map((e) => '<tr data-mentry="' + e.id + '"><td style="white-space:nowrap">' + esc(mDate(e.date)) + "</td><td>" + pill(e) + '</td><td class="hide-s">' + esc(e.category) + "</td><td><b>" + esc(e.description) + '</b><div class="small">' + who(e) +
    (e.valueBasis ? (e.party ? " · " : "") + "Value based on " + esc(e.valueBasis) : "") + (e.reference ? " · Ref " + esc(e.reference) : "") + '</div></td><td class="n">' + mNaira(e.amount) + "</td><td>" +
    (e.receipt ? '<a href="/admin/receipt?id=' + e.id + '" target="_blank" rel="noopener">View</a>' : '<span class="small">None</span>') + "</td></tr>").join("") ||
    '<tr><td colspan="6" class="small">Nothing recorded yet. Use the form to add the first entry.</td></tr>';
}

function editEntry(id) {
  const e = mData.entries.find((x) => x.id === id), f = $("#mForm");
  if (!e) return;
  setKind(e.kind);
  f.entryId.value = e.id; f.date.value = e.date; f.category.value = e.category; f.description.value = e.description; f.party.value = e.party;
  f.partyType.value = e.partyType; f.amount.value = e.amount; f.valueBasis.value = e.valueBasis; f.status.value = e.status || "paid";
  f.method.value = e.method; f.paidFrom.value = e.paidFrom; f.reference.value = e.reference; f.notes.value = e.notes; f.receipt.value = "";
  $("#mTitle").textContent = "Edit entry"; $("#mSave").textContent = "Save changes"; $("#mEditing").hidden = false;
  $("#mReceiptNow").innerHTML = e.receipt ? 'A receipt is on file. <a href="/admin/receipt?id=' + e.id + '" target="_blank" rel="noopener">View it</a>. Choosing a new file replaces it.' : "";
  $("#mStamp").textContent = "Recorded by " + e.createdBy + ", " + when(e.createdAt) + (e.updatedAt ? ". Last changed by " + e.updatedBy + ", " + when(e.updatedAt) : "") + ".";
  document.querySelectorAll("#mRows tr").forEach((tr) => tr.classList.toggle("sel", Number(tr.dataset.mentry) === id));
  f.scrollIntoView({ behavior: "smooth", block: "start" });
}
function resetEntryForm() {
  const f = $("#mForm"), date = f.date.value;
  f.reset(); f.entryId.value = ""; f.date.value = date; setKind(mKind);
  $("#mTitle").textContent = "Record an entry"; $("#mSave").textContent = "Save entry"; $("#mEditing").hidden = true; $("#mReceiptNow").textContent = ""; $("#mStamp").textContent = "";
  document.querySelectorAll("#mRows tr.sel").forEach((tr) => tr.classList.remove("sel"));
}
async function uploadReceipt(id, file) {
  if (file.size > 5 * 1024 * 1024) throw new Error("That file is over 5MB. Try a smaller photo or the PDF.");
  const res = await fetch("/admin/receipt?id=" + id, { method: "POST", credentials: "same-origin", headers: { "x-admin": "1", "content-type": file.type || "application/octet-stream" }, body: file });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The receipt did not upload.");
}

document.addEventListener("click", async (e) => {
  const el = (s) => e.target.closest(s);
  try {
    if (el("[data-mkind]")) { setKind(el("[data-mkind]").dataset.mkind); return; }
    if (el("[data-mf]")) { mFilter = el("[data-mf]").dataset.mf; drawEntries(); return; }
    if (el("[data-mprint]")) { $("#mPrinted").textContent = new Date().toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }); window.print(); return; }
    if (el("tr[data-mentry]") && !el("a")) { editEntry(Number(el("tr[data-mentry]").dataset.mentry)); return; }
    if (el("[data-mcancel]")) { resetEntryForm(); return; }
    if (el("[data-mdelete]")) {
      const f = $("#mForm");
      if (!confirm("Remove this entry? It stops counting in the totals and the CSV. A record that it was removed is kept.")) return;
      await call("money-delete", { id: Number(f.entryId.value) }); msg("Entry removed.", true); resetEntryForm(); loadMoney(); return;
    }
  } catch (err) { msg(err.message); }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "mForm") return;
  e.preventDefault();
  const f = e.target, btn = $("#mSave");
  const body = { kind: mKind, id: f.entryId.value };
  ["date", "category", "description", "party", "partyType", "amount", "valueBasis", "status", "method", "paidFrom", "reference", "notes"].forEach((k) => { body[k] = f[k].value; });
  const file = f.receipt.files[0];
  btn.disabled = true;
  try {
    const r = await call("money-entry", body);
    let note = body.id ? "Changes saved." : "Entry saved.";
    if (file) {
      try { await uploadReceipt(r.id, file); note += " Receipt attached."; }
      catch (err) { msg(note + " But the receipt did not upload: " + err.message + " Open the entry and try the file again."); resetEntryForm(); await loadMoney(); btn.disabled = false; return; }
    }
    msg(note, true); resetEntryForm(); await loadMoney();
  } catch (err) { msg(err.message); }
  btn.disabled = false;
});
`;
