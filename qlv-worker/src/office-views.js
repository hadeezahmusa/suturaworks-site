// Three admin-only screens: the Email tab (write and send from the portal
// address, with CC and attachments), the Invoices tab (make, download and
// email invoices) and, inside a sponsored booking in Registrations, the
// bulk upload of participants. PDFs and spreadsheets are made in this
// browser with the libraries on the site, like the certificates.

export const OFFICE_STYLE = String.raw`
#mailView textarea,#invView textarea{width:100%;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:10px 12px}
#mailView textarea[name=body]{min-height:240px}
#mailView textarea,#mailView input{font-weight:400}
#seatUp .st{white-space:normal;display:inline-block}
#mailView .att,#invView .att{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:6px 10px;border:1px solid var(--line);border-radius:7px;margin:0 0 6px;font-size:12px}
#invView select,#invView input,#seatUp select{font:inherit;border:1px solid var(--rule);border-radius:6px;padding:6px 8px;min-height:36px;max-width:100%}
#invView .ln{display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(180px,2fr) 70px 110px 110px 28px;gap:8px;align-items:center;margin:0 0 8px}
#invView .ln input{width:100%}
@media(max-width:800px){#invView .ln{grid-template-columns:1fr 1fr}}
#invView .tot{display:flex;justify-content:flex-end;gap:24px;font-weight:600;margin:6px 0 0}
#seatUp .st.bad{background:#FBE3E0;color:#8A2A20}#seatUp .st.amb{background:#FFF1D6;color:#7A5300}#seatUp .st.good{background:#E2F2F2;color:#19646D}
#seatUp table td{vertical-align:top}
`;

export const OFFICE_HTML = String.raw`<div id="mailView" hidden><div id="mailBox"></div></div><div id="invView" hidden><div id="invBox"></div></div>`;

export const OFFICE_JS = String.raw`
// ---------- shared: libraries from the site, files to base64 ----------
const offLoaded = {};
function offScript(f) {
  if (!offLoaded[f]) offLoaded[f] = new Promise((ok, bad) => { const s = document.createElement("script"); s.src = SITE + f + "?v=1"; s.onload = ok; s.onerror = () => { delete offLoaded[f]; bad(new Error("Could not load " + f + ". Check the connection and try again.")); }; document.head.appendChild(s); });
  return offLoaded[f];
}
function offB64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
const offNaira = (n) => "₦" + Math.round(n).toLocaleString("en-NG");
function offDownload(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); }
function offGoTab(t) { const b = document.querySelector('.tabs [data-tab="' + t + '"]'); if (b) b.click(); }

// ---------- the Email tab ----------
let mailData = null, mailFiles = [], mailInvoice = null, mailDraft = null;
async function loadMail() {
  const d = mailData = await call("mail");
  const v = mailDraft || {};
  $("#mailBox").innerHTML = '<div class="grid"><form class="card" id="mailForm" style="flex:3 1 560px"><h2>Write an email</h2>' +
    '<p class="small" style="margin:-4px 0 10px">Sends from <b>' + esc(d.from) + "</b>. Replies go to " + esc(d.replyTo) + ". It arrives in the QLV look, with no footer. " +
      d.room + " of 90 emails left today; each person in To and CC counts as one.</p>" +
    (mailInvoice ? '<div class="note" style="margin:0 0 10px">This email carries invoice <b>' + esc(mailInvoice.no) + "</b>. Sending marks it as sent, and it can't be edited after that.</div>" : "") +
    '<label class="fl">To <span class="small" style="font-weight:400">(separate several with commas)</span><textarea name="to" rows="2" placeholder="name@company.com, another@company.com">' + esc(v.to || "") + "</textarea></label>" +
    '<label class="fl">CC <span class="small" style="font-weight:400">(optional)</span><input type="text" name="cc" value="' + esc(v.cc || "") + '" placeholder="Copied in"></label>' +
    '<label class="fl">Subject<input type="text" name="subject" maxlength="200" value="' + esc(v.subject || "") + '" required></label>' +
    '<label class="fl">Message <span class="small" style="font-weight:400">(a blank line starts a new paragraph)</span><textarea name="body" required>' + esc(v.body || "") + "</textarea></label>" +
    '<div id="mailAtt"></div><label class="btn ghost" style="cursor:pointer">Attach files<input type="file" id="mailFile" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.docx,.doc,.xlsx,.xls,.pptx,.csv"></label>' +
    '<div class="actions"><button class="btn gold">Send email</button><button type="button" class="btn ghost" data-mail="clear">Clear</button></div></form>' +
    '<div class="card" style="flex:2 1 380px;padding:0;overflow-x:auto"><div style="padding:14px 16px 0"><h2>Sent from here</h2></div><table><tbody>' +
    (d.sent.map((m) => "<tr><td><b>" + esc(m.subject) + '</b><div class="small">To ' + esc(m.to.join(", ")) + (m.cc.length ? " · CC " + esc(m.cc.join(", ")) : "") + "</div>" +
      (m.attachments.length ? '<div class="small">Attached: ' + esc(m.attachments.map((a) => a.name).join(", ")) + "</div>" : "") +
      '<div class="small">' + esc(when(m.sent_at)) + " by " + esc(m.sent_by) + (m.ok ? "" : ' · <b style="color:#8A2A20">did not go</b>') + "</div></td></tr>").join("") || '<tr><td class="small">Nothing sent from here yet.</td></tr>') +
    "</tbody></table></div></div>";
  drawMailAtt();
}
function drawMailAtt() {
  const box = $("#mailAtt"); if (!box) return;
  box.innerHTML = mailFiles.map((f, i) => '<div class="att"><span>📎 ' + esc(f.name) + ' <span class="small">' + Math.max(1, Math.round(f.size / 1024)) + ' KB</span></span><button type="button" class="link" data-mailrm="' + i + '">Remove</button></div>').join("");
}
function mailKeep() { const f = $("#mailForm"); if (f) mailDraft = { to: f.to.value, cc: f.cc.value, subject: f.subject.value, body: f.body.value }; }
// Opens the Email tab already filled in, for example with an invoice attached.
function mailCompose(v) { mailDraft = v; mailFiles = v.files || []; mailInvoice = v.invoice || null; offGoTab("mail"); }
document.addEventListener("change", async (e) => {
  if (e.target.id !== "mailFile") return;
  for (const file of e.target.files) {
    if (file.size > 8 * 1024 * 1024) { msg(file.name + " is over 8 MB."); continue; }
    const bytes = new Uint8Array(await file.arrayBuffer());
    mailFiles.push({ name: file.name, type: file.type || "application/octet-stream", size: file.size, content: offB64(bytes) });
  }
  e.target.value = ""; drawMailAtt();
});
document.addEventListener("input", (e) => { if (e.target.closest("#mailForm")) mailKeep(); });
document.addEventListener("click", (e) => {
  const rm = e.target.closest("[data-mailrm]");
  if (rm) { mailFiles.splice(Number(rm.dataset.mailrm), 1); drawMailAtt(); return; }
  if (e.target.closest("[data-mail=clear]")) { if (!confirm("Clear this email?")) return; mailDraft = null; mailFiles = []; mailInvoice = null; loadMail(); }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "mailForm") return;
  e.preventDefault();
  const f = e.target;
  const to = f.to.value.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean), cc = f.cc.value.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  if (!confirm("Send \"" + f.subject.value.trim() + "\" to " + to.join(", ") + (cc.length ? ", copying " + cc.join(", ") : "") + (mailFiles.length ? ", with " + mailFiles.length + (mailFiles.length === 1 ? " attachment" : " attachments") : "") + "?")) return;
  const btn = f.querySelector(".btn.gold"); btn.disabled = true;
  try {
    await call("mail-send", { to: f.to.value, cc: f.cc.value, subject: f.subject.value, body: f.body.value, attachments: mailFiles.map(({ size, ...a }) => a), invoiceId: mailInvoice ? mailInvoice.id : null });
    msg("Sent to " + to.join(", ") + ".", true);
    mailDraft = null; mailFiles = []; mailInvoice = null; loadMail();
  } catch (err) { msg(err.message); btn.disabled = false; }
});

// ---------- the Invoices tab ----------
let invData = null, invEdit = null, invSigs = null;
const invToday = () => new Date().toISOString().slice(0, 10);
async function invLibs() {
  for (const f of ["vendor/pdf-lib.min.js", "vendor/fontkit.umd.min.js", "invoice.js"]) await offScript(f);
  await QLVInvoice.load(SITE);
  if (!invSigs) invSigs = await call("invoice-signatures");
}
async function invPdf(inv) { await invLibs(); return QLVInvoice.build(inv, invData.settings, invSigs); }
function invBlank() {
  return { id: null, bill: { org: "", contact: "", title: "", address: "", email: "", phone: "" }, issueDate: invToday(), dueDate: invData.settings.defaultDue,
    lines: [{ item: "sponsored", title: invData.catalogue.sponsored.title, description: invData.catalogue.sponsored.description, qty: 6, unit: invData.catalogue.sponsored.unit }] };
}
async function loadInvoices() {
  const d = invData = await call("invoices");
  if (!invEdit) invEdit = invBlank();
  const s = d.settings, cat = d.catalogue;
  const ITEMS = [["sponsored", "Sponsored seats"], ["standard", "Standard seats"], ["member", "JCI Aso member seats"], ["corporate3", "Corporate team, 3 seats"], ["corporate5", "Corporate team, 5 seats"], ["lead", "Lead partner"], ["supporting", "Supporting partner"], ["community", "Community partner"], ["custom", "Custom line"]];
  const lineRow = (l, i) => '<div class="ln" data-ln="' + i + '"><select data-lf="item">' + ITEMS.map(([k, n]) => '<option value="' + k + '"' + (k === l.item ? " selected" : "") + ">" + n + "</option>").join("") + "</select>" +
    '<div><input data-lf="title" value="' + esc(l.title) + '" placeholder="Line title"><input data-lf="description" value="' + esc(l.description || "") + '" placeholder="Description (optional)" style="margin-top:4px;font-size:12px"></div>' +
    '<input data-lf="qty" type="number" min="1" value="' + l.qty + '" aria-label="Quantity"><input data-lf="unit" type="number" min="0" value="' + l.unit + '" aria-label="Unit price">' +
    '<span class="small" style="text-align:right">' + offNaira(l.qty * l.unit) + "</span>" + (invEdit.lines.length > 1 ? '<button type="button" class="link" data-lrm="' + i + '" aria-label="Remove line">✕</button>' : "<span></span>") + "</div>";
  const total = invEdit.lines.reduce((n, l) => n + l.qty * l.unit, 0);
  const seats = invEdit.lines.reduce((n, l) => n + l.qty * (cat[l.item] ? cat[l.item].seatsEach : 0), 0);
  const low = invEdit.lines.find((l) => l.item === "sponsored" && l.qty < 6);
  const sigRow = (who, label) => '<div class="att"><span><b>' + label + "</b> · " + (d.signatures[who] ? "uploaded " + esc(when(d.signatures[who].at)) : "not uploaded, the line is left for signing by hand") + '</span><span><label class="link" style="cursor:pointer">' + (d.signatures[who] ? "Replace" : "Upload PNG") + '<input type="file" accept="image/png" data-invsig="' + who + '" hidden></label>' + (d.signatures[who] ? ' · <button type="button" class="link" data-invsigrm="' + who + '">Remove</button>' : "") + "</span></div>";
  const status = (v) => v.status === "cancelled" ? '<span class="st released">Cancelled</span>' : v.status === "sent" ? '<span class="st confirmed">Sent ' + esc(when(v.emailedAt)) + "</span>" : '<span class="st awaiting">Draft</span>';
  $("#invBox").innerHTML =
    (d.missing.length ? '<div class="miss" style="margin:0 0 14px">Before an invoice can be emailed, add the ' + esc(d.missing.join(", ")) + " under Payment details below.</div>" : "") +
    '<div class="grid"><form class="card" id="invForm" style="flex:3 1 640px"><h2>' + (invEdit.id ? "Edit " + esc(invEdit.no) : "New invoice") + '</h2><p class="small" style="margin:-4px 0 10px">' + (invEdit.id ? "A draft can be changed until it is emailed." : "The number is given when you save, from " + esc("QLV " + String(Math.max(s.nextNumber, (d.invoices[0] ? d.invoices[0].number + 1 : 0))).padStart(4, "0")) + ".") + "</p>" +
      '<div class="small" style="font-weight:600;margin:0 0 6px">Bill to</div><div class="two">' +
      [["org", "Organisation *"], ["contact", "Contact name"], ["title", "Contact title"], ["email", "Email (to send it)"], ["phone", "Phone"], ["address", "Address"]].map(([k, n]) => '<label class="fl">' + n + '<input data-bf="' + k + '" value="' + esc(invEdit.bill[k] || "") + '"></label>').join("") + "</div>" +
      '<div class="two"><label class="fl">Issue date<input type="date" data-df="issueDate" value="' + esc(invEdit.issueDate) + '"></label><label class="fl">Due date<input type="date" data-df="dueDate" value="' + esc(invEdit.dueDate) + '"></label></div>' +
      '<div class="small" style="font-weight:600;margin:6px 0">Lines <span style="font-weight:400">(up to four, so it fits on one page)</span></div>' + invEdit.lines.map(lineRow).join("") +
      (invEdit.lines.length < 4 ? '<button type="button" class="link" data-ladd="1">+ Add a line</button>' : "") +
      (low ? '<div class="miss" style="margin:8px 0 0">Sponsored seats start at 6.</div>' : "") +
      '<div class="tot"><span>Total due ' + offNaira(total) + '</span><span class="small" style="font-weight:400">Seats on this invoice: ' + seats + " (not printed)</span></div>" +
      '<div class="actions"><button class="btn"' + (low ? " disabled" : "") + ">" + (invEdit.id ? "Save changes" : "Save and number it") + '</button><button type="button" class="btn ghost" data-inv="preview">Preview PDF</button>' + (invEdit.id ? '<button type="button" class="link" data-inv="new">Start a new one instead</button>' : "") + "</div></form>" +
    '<form class="card" id="invSet" style="flex:2 1 360px"><h2>Payment details and signatures</h2><p class="small" style="margin:-4px 0 10px">Printed on every invoice.</p>' +
      [["bankName", "Bank"], ["accountName", "Account name"], ["accountNumber", "Account number"], ["paymentsEmail", "Payments email (proof of payment)"], ["treasurerName", "Left signature: name"], ["treasurerTitle", "Left signature: title"], ["signatoryName", "Right signature: name"], ["signatoryTitle", "Right signature: title"]].map(([k, n]) => '<label class="fl">' + n + '<input name="' + k + '" value="' + esc(s[k] || "") + '"></label>').join("") +
      '<div class="two"><label class="fl">Default due date<input type="date" name="defaultDue" value="' + esc(s.defaultDue) + '"></label><label class="fl">Next number<input type="number" name="nextNumber" value="' + esc(String(s.nextNumber)) + '"></label></div>' +
      sigRow("treasurer", "Treasurer") + sigRow("signatory", "Chairperson") + '<div class="actions"><button class="btn ghost">Save details</button></div></form></div>' +
    '<div class="card" style="margin-top:14px;padding:0;overflow-x:auto"><div style="padding:14px 16px 0"><h2>Invoices</h2></div><table><thead><tr><th>No.</th><th>Bill to</th><th>Total</th><th>Due</th><th>Status</th><th></th></tr></thead><tbody>' +
      (d.invoices.map((v) => '<tr><td class="mono">' + esc(v.no) + "</td><td><b>" + esc(v.bill.org) + '</b><div class="small">' + esc(v.bill.email || "No email") + "</div></td><td>" + offNaira(v.total) + '<div class="small">' + v.seats + " seats</div></td><td class=\"small\">" + esc(QLVday(v.dueDate)) + "</td><td>" + status(v) + '</td><td class="small" style="white-space:nowrap">' +
        '<button class="link" data-invpdf="' + v.id + '">Download</button>' + (v.status !== "cancelled" ? ' · <button class="link" data-invmail="' + v.id + '">Email</button>' : "") + (v.status === "draft" ? ' · <button class="link" data-invedit="' + v.id + '">Edit</button>' : "") +
        ' · <button class="link" data-invcopy="' + v.id + '">Copy</button>' + (v.status !== "cancelled" ? ' · <button class="link" data-invcancel="' + v.id + '">Cancel</button>' : "") + "</td></tr>").join("") || '<tr><td colspan="6" class="small">No invoices yet.</td></tr>') +
      "</tbody></table></div>";
}
const QLVday = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return d + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] + " " + y; };
function invRead() {
  const f = $("#invForm"); if (!f) return;
  f.querySelectorAll("[data-bf]").forEach((x) => { invEdit.bill[x.dataset.bf] = x.value; });
  f.querySelectorAll("[data-df]").forEach((x) => { invEdit[x.dataset.df] = x.value; });
  f.querySelectorAll("[data-ln]").forEach((row) => {
    const l = invEdit.lines[Number(row.dataset.ln)];
    row.querySelectorAll("[data-lf]").forEach((x) => { const k = x.dataset.lf; l[k] = k === "qty" || k === "unit" ? Math.max(0, Math.round(Number(x.value) || 0)) : x.value; });
  });
}
function invShape(v) {
  const lines = v.lines.map((l) => ({ ...l, amount: l.qty * l.unit }));
  const total = lines.reduce((n, l) => n + l.amount, 0);
  return { ...v, no: v.no || "QLV " + String(Math.max(invData.settings.nextNumber, invData.invoices[0] ? invData.invoices[0].number + 1 : 0)).padStart(4, "0"), status: v.status || "draft", lines, subtotal: total, total };
}
async function invOpenPdf(v) {
  const w = window.open("", "_blank");
  const pdf = await invPdf(invShape(v));
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  if (w) w.location = url; else offDownload(new Blob([pdf], { type: "application/pdf" }), v.no + ".pdf");
}
document.addEventListener("input", (e) => {
  if (!e.target.closest("#invForm")) return;
  invRead();
  if (e.target.dataset.lf === "qty" || e.target.dataset.lf === "unit") {
    const row = e.target.closest("[data-ln]"), l = invEdit.lines[Number(row.dataset.ln)];
    row.children[4].textContent = offNaira(l.qty * l.unit);
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.closest("#invForm") && e.target.dataset.lf === "item") {
    invRead();
    const l = invEdit.lines[Number(e.target.closest("[data-ln]").dataset.ln)], c = invData.catalogue[e.target.value];
    Object.assign(l, { item: e.target.value, title: c.title, description: c.description, unit: c.unit, qty: c.min || 1 });
    return loadInvoices();
  }
  if (e.target.closest("#invForm") && e.target.dataset.lf === "qty") { invRead(); return loadInvoices(); }
  const sig = e.target.closest("[data-invsig]");
  if (sig && sig.files[0]) {
    if (sig.files[0].type !== "image/png") return msg("Upload the signature as a PNG file.");
    const image = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(sig.files[0]); });
    try { await call("invoice-signature", { who: sig.dataset.invsig, image }); invSigs = null; msg("Signature saved.", true); invRead(); loadInvoices(); } catch (err) { msg(err.message); }
  }
});
document.addEventListener("click", async (e) => {
  const el = (s) => e.target.closest(s);
  if (!el("#invView")) return;
  try {
    if (el("[data-ladd]")) { invRead(); const c = invData.catalogue.custom; invEdit.lines.push({ item: "custom", title: "", description: "", qty: 1, unit: 0 }); return loadInvoices(); }
    if (el("[data-lrm]")) { invRead(); invEdit.lines.splice(Number(el("[data-lrm]").dataset.lrm), 1); return loadInvoices(); }
    if (el("[data-inv=new]")) { invEdit = invBlank(); return loadInvoices(); }
    if (el("[data-inv=preview]")) { invRead(); return invOpenPdf(invEdit); }
    if (el("[data-invsigrm]")) { if (!confirm("Remove this signature?")) return; await call("invoice-signature", { who: el("[data-invsigrm]").dataset.invsigrm, remove: true }); invSigs = null; return loadInvoices(); }
    const find = (attr) => invData.invoices.find((v) => v.id === Number(el("[" + attr + "]").getAttribute(attr)));
    if (el("[data-invpdf]")) { const v = find("data-invpdf"); const pdf = await invPdf(invShape(v)); return offDownload(new Blob([pdf], { type: "application/pdf" }), v.no.replace(" ", "-") + "-" + v.bill.org.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 40) + ".pdf"); }
    if (el("[data-invedit]")) { const v = find("data-invedit"); invEdit = JSON.parse(JSON.stringify(v)); loadInvoices(); return $("#invForm").scrollIntoView(); }
    if (el("[data-invcopy]")) { const v = find("data-invcopy"); invEdit = { ...JSON.parse(JSON.stringify(v)), id: null, no: null, status: null, emailedAt: null, cancelledAt: null, copiedFrom: v.id, issueDate: invToday() }; loadInvoices(); msg("Copied " + v.no + ". Change what you need and save: it gets a new number.", true); return $("#invForm").scrollIntoView(); }
    if (el("[data-invcancel]")) { const v = find("data-invcancel"); if (!confirm("Cancel " + v.no + "? It keeps its number and prints Cancelled. This can't be undone.")) return; await call("invoice-cancel", { id: v.id }); return loadInvoices(); }
    if (el("[data-invmail]")) {
      const v = find("data-invmail");
      if (invData.missing.length) return msg("Add the " + invData.missing.join(", ") + " under Payment details first.");
      const pdf = await invPdf(invShape(v)), s = invData.settings;
      const first = (v.bill.contact || "").split(" ")[0] || "Sir/Madam";
      const body = "Dear " + first + ",\n\nThank you for supporting Quality Leadership Value 2026. Please find attached invoice " + v.no + " for " + offNaira(v.total) + ", due by " + QLVInvoice.day(v.dueDate) + ".\n\n" +
        "Please use " + v.no + " as your transfer reference and send the proof of payment to " + s.paymentsEmail + ".\n\n" +
        "Once payment is confirmed, we'll send you a link to share with your participants, or you can send us their details in our template.\n\n" +
        "Warm regards,\n" + s.signatoryName + "\n" + s.signatoryTitle;
      return mailCompose({ to: v.bill.email || "", cc: "", subject: "Invoice " + v.no + " for QLV 2026", body, invoice: { id: v.id, no: v.no },
        files: [{ name: v.no.replace(" ", "-") + "-QLV-2026-Invoice.pdf", type: "application/pdf", size: pdf.length, content: offB64(pdf) }] });
    }
  } catch (err) { msg(err.message); }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id === "invForm") {
    e.preventDefault(); invRead();
    try {
      const r = await call("invoice-save", { id: invEdit.id, bill: invEdit.bill, issueDate: invEdit.issueDate, dueDate: invEdit.dueDate, lines: invEdit.lines, copiedFrom: invEdit.copiedFrom || null });
      const v = r.invoices.find((x) => x.id === r.id);
      invEdit = invBlank(); invData = r; msg("Saved " + v.no + ". Download it or email it from the list.", true); loadInvoices();
    } catch (err) { msg(err.message); }
  }
  if (e.target.id === "invSet") {
    e.preventDefault(); invRead();
    const f = e.target, b = {};
    ["bankName", "accountName", "accountNumber", "paymentsEmail", "treasurerName", "treasurerTitle", "signatoryName", "signatoryTitle", "defaultDue", "nextNumber"].forEach((k) => { b[k] = f[k].value; });
    try { await call("invoice-settings", b); msg("Details saved.", true); loadInvoices(); } catch (err) { msg(err.message); }
  }
});

// ---------- bulk upload on a sponsored booking ----------
let seatData = null, seatPreview = null, seatFile = null;
async function loadSeatUpload(ref) {
  const box = $("#seatUp"); if (!box) return;
  const d = seatData = await call("seats?ref=" + encodeURIComponent(ref));
  const pv = seatPreview && seatPreview.ref === ref ? seatPreview : null;
  const label = { ok: '<span class="st good">Will register</span>', registered: '<span class="st amb">Already registered, skipped</span>', error: '<span class="st bad">Fix in the file</span>' };
  box.innerHTML = '<div class="hr"></div><h2>Register people from a file</h2>' +
    '<p class="small" style="margin:0 0 8px"><b>' + d.used + " of " + d.seats + " seats used</b>, " + d.free + " free. The share link keeps working for the free seats; nobody can go over " + d.seats + ". " +
      (d.paid ? "Payment is verified, so everyone registered from a file gets their ticket straight away." : "<b>Verify the payment first:</b> tickets from a file go out straight away.") + "</p>" +
    '<div class="actions" style="margin:0 0 10px"><button class="btn ghost" data-seat="template"' + (d.free ? "" : " disabled") + ">Download the template (" + d.free + (d.free === 1 ? " row)" : " rows)") + "</button>" +
      '<label class="btn ghost" style="cursor:pointer">Upload the filled file<input type="file" id="seatFile" accept=".xlsx,.csv" hidden></label></div>' +
    (pv ? '<div class="card" style="padding:12px;margin:0 0 10px"><b>' + esc(pv.fileName) + "</b>: " + pv.ok + " to register, " + pv.registered + " already registered, " + pv.errors + " to fix." +
      (pv.blocked ? '<div class="miss" style="margin:8px 0 0">' + esc(pv.blocked) + "</div>" : "") +
      '<div style="overflow-x:auto;margin-top:8px"><table><thead><tr><th>Line</th><th>Person</th><th>Status</th></tr></thead><tbody>' +
      pv.rows.map((x) => "<tr><td>" + x.line + "</td><td><b>" + esc((x.first + " " + x.last).trim()) + '</b><div class="small">' + esc(x.email) + (x.phone ? " · " + esc(x.phone) : "") + "</div><div class=\"small\">" + esc(x.organisation) + "</div></td><td>" + label[x.status] + (x.errors.length ? '<div class="small">' + esc(x.errors.join("; ")) + "</div>" : "") + "</td></tr>").join("") +
      "</tbody></table></div>" +
      (pv.ok && !pv.blocked && d.paid ? '<label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:10px 0 0"><input type="checkbox" id="seatNotify" checked> Email ' + esc(d.contact || d.org) + " a short summary</label>" +
        '<div class="actions"><button class="btn gold" data-seat="import">Register the ' + pv.ok + (pv.ok === 1 ? " valid row" : " valid rows") + '</button><button class="btn ghost" data-seat="discard">Discard</button></div>' : '<div class="actions"><button class="btn ghost" data-seat="discard">Discard</button></div>') + "</div>" : "") +
    (d.holders.length ? '<details><summary class="small" style="cursor:pointer">Who holds the ' + d.used + " seats</summary>" + d.holders.map((h) => '<div class="small">' + esc(h.name) + " · " + esc(h.ref) + " · " + esc(h.via) + (h.cancelled ? " · cancelled" : "") + "</div>").join("") + "</details>" : "") +
    (d.uploads.length ? '<div class="small" style="margin-top:6px">' + d.uploads.map((u) => esc(when(u.uploaded_at)) + ": " + esc(u.file_name) + ", " + u.imported + " registered, " + u.skipped + " skipped, " + u.failed + " to fix, by " + esc(u.uploaded_by)).join("<br>") + "</div>" : "");
}
async function seatTemplate() {
  await offScript("vendor/exceljs.min.js");
  const d = seatData, wb = new ExcelJS.Workbook();
  wb.creator = "QLV 2026"; wb.title = "QLV 2026 Sponsored participants"; wb.subject = d.ref; wb.keywords = d.ref;
  const ws = wb.addWorksheet("Participants", { views: [{ state: "frozen", ySplit: 4 }] });
  const lists = wb.addWorksheet("Lists", { state: "veryHidden" });
  d.situations.forEach((s, i) => { lists.getCell("A" + (i + 1)).value = s; });
  ws.getCell("A1").value = "QLV 2026 · Sponsored participants"; ws.getCell("A1").font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F2B63" } };
  ws.getCell("A2").value = "Sponsored booking " + d.ref + " · " + d.org + " · " + d.free + " seats to fill. Fill one row per person. Do not change the column headings.";
  ws.getCell("A2").font = { name: "Arial", size: 10, color: { argb: "FF4A5B75" } };
  const head = ws.getRow(4); head.values = d.columns; head.height = 22;
  head.eachCell((c) => { c.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F2B63" } }; c.alignment = { vertical: "middle" }; });
  for (let i = 0; i < d.free; i++) {
    const r = ws.getRow(5 + i); r.values = [i + 1, "", "", "", "", d.org, ""];
    r.eachCell({ includeEmpty: true }, (c) => { c.font = { name: "Arial" }; });
    ws.getCell("G" + (5 + i)).dataValidation = { type: "list", allowBlank: true, formulae: ["Lists!$A$1:$A$" + d.situations.length], showErrorMessage: true, errorTitle: "Choose from the list", error: "Pick one of the four options." };
    ws.getCell("E" + (5 + i)).numFmt = "@";
  }
  [6, 18, 18, 30, 18, 30, 44].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  const how = wb.addWorksheet("How to fill this in");
  ["How to fill this in", "", "1. One row per person attending on your sponsored seats. This file has one row for each seat still free.", "2. Columns marked * are required. Leave unused rows empty.",
   "3. Use a different email for each person. Each person receives their own ticket and QLV page link at that email.", "4. Phone numbers in the format 0803 123 4567 or +234 803 123 4567.",
   "5. Organisation is filled in for you. Change it only if a person works elsewhere.", "6. For \"Which is closest to you?\", choose one of the options in the list.",
   "7. Do not change the column headings or add columns.", "8. Save the file and send it back to the QLV team."].forEach((t, i) => { const c = how.getCell("A" + (i + 1)); c.value = t; c.font = { name: "Arial", bold: i === 0, size: i === 0 ? 14 : 11, color: { argb: i === 0 ? "FF0F2B63" : "FF0E1B33" } }; });
  how.getColumn(1).width = 110;
  offDownload(new Blob([await wb.xlsx.writeBuffer()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "QLV-2026-Participants-" + d.ref + ".xlsx");
}
const cellText = (v) => v === null || v === undefined ? "" : typeof v === "object" ? (v.text !== undefined ? String(v.text) : v.result !== undefined ? String(v.result) : v.richText ? v.richText.map((x) => x.text).join("") : v.hyperlink ? String(v.hyperlink).replace(/^mailto:/, "") : "") : String(v);
function csvRows(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { row.push(cur); cur = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += ch;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
// Reads the file into plain rows, checking the headings first.
async function seatRead(file) {
  let grid = [], fileRef = null;
  if (/\.csv$/i.test(file.name)) grid = csvRows(await file.text());
  else {
    await offScript("vendor/exceljs.min.js");
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
    fileRef = wb.subject || null;
    const ws = wb.getWorksheet("Participants") || wb.worksheets[0];
    ws.eachRow({ includeEmpty: true }, (r, n) => { grid[n - 1] = (r.values || []).slice(1).map(cellText); });
    grid = Array.from(grid, (r) => r || []);
    const a2 = grid[1] && grid[1][0] || ""; const m = /booking\s+(\S+)\s+·/.exec(a2); if (!fileRef && m) fileRef = m[1];
  }
  const norm = (h) => String(h || "").replace(/\*/g, "").trim().toLowerCase();
  const hi = grid.findIndex((r) => r && r.some((c) => norm(c) === "email"));
  if (hi < 0) throw new Error("The headings are missing. Use the template, and keep its headings as they are.");
  const heads = grid[hi].map(norm);
  const need = { first: "first name", last: "last name", email: "email", phone: "phone", organisation: "organisation", situation: "which is closest to you?" };
  const at = {};
  for (const [k, h] of Object.entries(need)) { at[k] = heads.indexOf(h); if (at[k] < 0) throw new Error('The heading "' + h.replace(/^./, (x) => x.toUpperCase()) + '" is missing or changed. Use the template, and keep its headings as they are.'); }
  const rows = [];
  for (let i = hi + 1; i < grid.length; i++) {
    const r = grid[i] || [];
    const row = { line: i + 1 }; for (const k of Object.keys(need)) row[k] = (r[at[k]] || "").trim();
    if (["first", "last", "email", "phone", "situation"].some((k) => row[k])) rows.push(row);
  }
  return { rows, fileRef };
}
document.addEventListener("change", async (e) => {
  if (e.target.id !== "seatFile" || !e.target.files[0]) return;
  const file = e.target.files[0]; e.target.value = "";
  try {
    const { rows, fileRef } = await seatRead(file);
    const r = await call("seats-preview", { ref: seatData.ref, rows, fileRef });
    seatPreview = { ...r, ref: seatData.ref, fileName: file.name, rows: r.rows, sent: rows, fileRef };
    loadSeatUpload(seatData.ref);
  } catch (err) { msg(err.message); }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-seat]"); if (!b) return;
  try {
    if (b.dataset.seat === "template") return seatTemplate();
    if (b.dataset.seat === "discard") { seatPreview = null; return loadSeatUpload(seatData.ref); }
    if (b.dataset.seat === "import") {
      if (!confirm("Register " + seatPreview.ok + (seatPreview.ok === 1 ? " person" : " people") + " on " + seatData.ref + " and email each their ticket now?")) return;
      b.disabled = true;
      const r = await call("seats-import", { ref: seatData.ref, rows: seatPreview.sent, fileRef: seatPreview.fileRef, fileName: seatPreview.fileName, notify: !!($("#seatNotify") && $("#seatNotify").checked) });
      seatPreview = null;
      msg(r.imported + " registered and sent their tickets." + (r.skipped ? " " + r.skipped + " skipped." : "") + (r.failed ? " " + r.failed + " to fix in the file." : "") + (r.sponsorEmailed ? " The sponsor has a summary." : ""), true);
      openReg(seatData.ref);
    }
  } catch (err) { msg(err.message); b.disabled = false; }
});
`;
