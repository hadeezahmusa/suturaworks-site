// The E-certificates tab: signatures, the confirmed top three, names worth a
// second look, the certificates for the sprinters checked in on Saturday and
// the thank-you emails. Admin only. The PDFs are drawn in this browser with
// qlv2026/certificate.js and the fonts on the site, then sent one by one.

export const CERTS_STYLE = String.raw`
#certsView .grey td{color:var(--mute)}
#certsView .ctid{font-family:'IBM Plex Mono',monospace;font-size:12px}
#certsView .sig{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
#certsView .sig img{height:42px;max-width:180px;object-fit:contain;background:#FBFAF6;border:1px solid var(--line);border-radius:6px;padding:2px 6px}
#certsView select{font:inherit;border:1px solid var(--rule);border-radius:6px;padding:6px 8px;min-height:36px}
#certsView textarea{width:100%;min-height:200px;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:10px 12px}
#certsView .flag{display:inline-block;background:#FFF4D6;color:#7A5300;border-radius:5px;padding:1px 6px;font-size:11px;margin:0 4px 0 0}
#certsView iframe{width:100%;height:360px;border:1px solid var(--line);border-radius:8px;background:#fff}
`;

export const CERTS_HTML = String.raw`<div id="certsView" hidden><div id="ctBox"></div></div>`;

export const CERTS_JS = String.raw`
let ctData = null, ctSigs = null, ctLibsReady = null, ctSel = null;
function ctScript(src) {
  return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("Could not load the certificate tools. Check the connection and try again.")); document.head.appendChild(s); });
}
async function ctLibs() {
  if (!ctLibsReady) ctLibsReady = (async () => {
    for (const f of ["vendor/pdf-lib.min.js", "vendor/fontkit.umd.min.js", "certificate.js"]) await ctScript(SITE + f + "?v=1");
    await QLVCert.load(SITE);
  })().catch((err) => { ctLibsReady = null; throw err; });
  await ctLibsReady;
  if (!ctSigs) ctSigs = await call("cert-signatures");
}
const ctCert = (r) => ({ id: r.certId, version: r.version, place: r.place, name: r.printedName, table: r.tableName });
async function ctPdf(r) { await ctLibs(); return QLVCert.build(ctCert(r), ctSigs); }
// The winning team's second certificate: Participation, numbered with -P.
const ctPart = (r) => ({ ...r, version: "participation", place: null, certId: r.partId });
function ctB64(bytes) { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
const PLACE_WORD = ["", "First", "Second", "Third"];

async function loadCerts() {
  const d = ctData = await call("certs");
  const box = $("#ctBox");
  if (d.enabled && !ctSigs && (d.signatures.president || d.signatures.chair)) ctSigs = await call("cert-signatures");
  if (!d.enabled) { box.innerHTML = '<div class="card"><h2>E-certificates</h2><p class="small" style="margin:0">Certificates go only to people checked in on the day. Turn on check-in to use this.</p></div>'; return; }
  const sigOk = d.signatures.president && d.signatures.chair;
  const ach = d.rows.filter((r) => r.checkedIn && !r.held && r.version === "achievement");
  const par = d.rows.filter((r) => r.checkedIn && !r.held && r.version === "participation");
  const held = d.rows.filter((r) => r.checkedIn && r.held);
  const out = d.rows.filter((r) => !r.checkedIn);
  const flagged = d.rows.filter((r) => r.checkedIn && r.flags.length);
  const sigRow = (who, label) => {
    const s = d.signatures[who];
    return '<div class="sig"><div><b>' + label + '</b><div class="small">' + (s ? "Uploaded " + esc(when(s.at)) : "Not uploaded yet") + "</div></div>" +
      '<div style="display:flex;gap:10px;align-items:center">' + (s && ctSigs && ctSigs[who] ? '<img alt="" src="' + ctSigs[who] + '">' : "") +
      '<label class="btn ghost" style="cursor:pointer">' + (s ? "Replace" : "Upload PNG") + '<input type="file" accept="image/png" data-ctsig="' + who + '" hidden></label>' +
      (s ? '<button class="link" data-ctsigrm="' + who + '">Remove</button>' : "") + "</div></div>";
  };
  const res = d.results, prop = d.proposed;
  const pick = (i, sel) => '<select data-ctplace="' + i + '"><option value="">Choose</option>' + prop.tables.map((t) => '<option value="' + t.index + '"' + (t.index === sel ? " selected" : "") + ">" + esc(t.name) + "</option>").join("") + "</select>";
  const resultsCard = res
    ? '<p style="margin:0 0 8px"><b>Confirmed:</b> ' + res.names.map((n, i) => PLACE_WORD[i + 1] + " " + esc(n)).join(", ") + '</p><p class="small" style="margin:0 0 8px">By ' + esc(res.by) + ", " + esc(when(res.confirmedAt)) + (res.followsScores ? ". Matches the scoring order." : ". Set by hand, for a tie the judges decided.") + "</p>" +
      (JSON.stringify(res.top) !== JSON.stringify(prop.order.map((o) => o.index)) && prop.order.length === 3 ? '<div class="miss" style="margin:0 0 8px">The scoring order is now ' + prop.order.map((o) => esc(o.name)).join(", ") + ". Change the confirmed results if that is right.</div>" : "") +
      '<button class="btn ghost" data-ct="unconfirm">Change the results</button>'
    : '<p class="small" style="margin:0 0 8px">From Scoring: highest average of the five criteria, a tie going to the higher "Outlives the team" average, then to the judges. ' +
      (prop.allComplete ? "Every team is fully scored." : "Not every team is fully scored yet.") + (prop.tieAtThree ? " Third place is tied: choose the order the judges decided." : "") + "</p>" +
      prop.order.map((o, i) => '<div class="small" style="margin:0 0 4px">' + PLACE_WORD[i + 1] + ": " + esc(o.name) + ", average " + esc(o.avg) + ' / 25, Outlives the team ' + esc(o.outlives) + ' / 5' + (o.tied ? " (tied)" : "") + "</div>").join("") +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:10px 0">' + [0, 1, 2].map((i) => '<label class="small">' + PLACE_WORD[i + 1] + "<br>" + pick(i, prop.order[i] && prop.order[i].index) + "</label>").join("") + "</div>" +
      '<button class="btn gold" data-ct="confirm">Confirm results</button>';
  const status = (r) => r.changed ? '<span class="st queried">Changed since sent</span>' : r.sentAt ? '<span class="st confirmed">Sent ' + esc(when(r.sentAt)) + "</span>" : '<span class="st awaiting">Not sent</span>';
  const row = (r) => '<tr><td class="ctid">' + esc(r.certId) + (r.partId ? "<br>" + esc(r.partId) : "") + "</td><td><b>" + esc(r.printedName) + "</b>" + (r.nameEdited ? '<div class="small">Name corrected</div>' : "") + "</td><td class=\"small\">" +
    (r.version === "achievement" ? PLACE_WORD[r.place] + " place · " : "") + esc(r.tableName || "No team") + '</td><td class="small hide-s">' + esc(r.email || "") + "</td><td>" + status(r) + '</td><td class="small" style="white-space:nowrap">' +
    '<button class="link" data-ctpv="' + r.ticketId + '">Preview' + (r.partId ? " Achievement" : "") + "</button> · " + (r.partId ? '<button class="link" data-ctpv="' + r.ticketId + '" data-part="1">Preview Participation</button> · ' : "") + '<button class="link" data-ctname="' + r.ticketId + '">Edit name</button>' +
    (r.sentAt ? ' · <button class="link" data-ctsend="' + r.ticketId + '">Resend</button>' : "") + "</td></tr>";
  const head = '<table><thead><tr><th>ID</th><th>Name on the certificate</th><th>Team</th><th class="hide-s">Email</th><th>Status</th><th></th></tr></thead><tbody>';
  const issue = (list, kind, label) => {
    const n = list.filter((r) => !r.sentAt).length, ch = list.filter((r) => r.changed).length;
    const why = !sigOk ? "Upload both signatures first." : !res ? "Confirm the results first, so the winning team gets both certificates." : "";
    return '<div class="actions" style="margin:0 0 10px">' + (why ? '<span class="small" style="align-self:center">' + why + "</span>" : "") +
      '<button class="btn gold" data-ctissue="' + kind + '"' + (n && !why ? "" : " disabled") + ">Issue " + n + " " + label + (n === 1 ? " certificate" : " certificates") + "</button>" +
      (ch ? '<button class="btn ghost" data-ctresend="' + kind + '"' + (why ? " disabled" : "") + ">Resend " + ch + " changed</button>" : "") + "</div>";
  };
  const th = d.thanks, ready = th.people.filter((p) => p.eligible && !p.sentAt);
  box.innerHTML =
    '<div class="grid">' +
    '<div class="card" style="flex:1 1 360px"><h2>Signatures</h2><p class="small" style="margin:-4px 0 6px">Transparent PNGs. Each sits on the line above the name. Issuing stays off until both are here.</p>' +
      sigRow("president", "JCIN Amb. Peter Emmanuel Yilbiem, President") + sigRow("chair", "Hadeezah Balarabe Musa, Chairperson") + "</div>" +
    '<div class="card" style="flex:1 1 360px"><h2>Top three teams</h2>' + resultsCard + "</div></div>" +
    (flagged.length ? '<div class="card" style="margin-top:14px"><h2>Names to check</h2><p class="small" style="margin:-4px 0 8px">These print exactly as shown. Correcting one here changes only the certificate, not the ticket.</p>' +
      flagged.map((r) => '<div class="sig"><span><b>' + esc(r.printedName) + "</b> " + r.flags.map((f) => '<span class="flag">' + esc(f) + "</span>").join("") + '</span><button class="link" data-ctname="' + r.ticketId + '">Edit name</button></div>').join("") + "</div>" : "") +
    '<div class="card" style="margin-top:14px;padding:0;overflow-x:auto"><div style="padding:14px 16px 0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><h2 style="margin:0">Certificates</h2><p class="small" style="margin:4px 0 10px">Only sprinters checked in on Saturday. The winning team gets two certificates, Achievement and Participation (numbered with -P). Everyone else, second and third included, gets Participation. The email carries their feedback link and the certificate downloads once they answer. Nothing goes until you press Issue.</p></div>' +
      '<button class="btn ghost" data-ct="zip"' + (ach.length + par.length ? "" : " disabled") + ">Download all</button></div>" +
      (res ? '<div style="padding:0 16px"><h2 style="font-size:14px">Winning team: Achievement and Participation · ' + ach.length + "</h2>" + issue(ach, "achievement", "Achievement") + "</div>" + head + ach.map(row).join("") + "</tbody></table>" : "") +
      '<div style="padding:12px 16px 0"><h2 style="font-size:14px">Participation · ' + par.length + "</h2>" + issue(par, "participation", "Participation") + "</div>" + head + (par.map(row).join("") || '<tr><td colspan="6" class="small">Nobody checked in yet.</td></tr>') + "</tbody></table>" +
      (held.length ? '<div style="padding:12px 16px 0"><h2 style="font-size:14px">Waiting for the sponsor\'s payment · ' + held.length + '</h2><p class="small" style="margin:0 0 8px">Checked in on sponsored seats. Their certificates and feedback links unlock here once the sponsor\'s payment is verified on the Registrations tab.</p></div><table class="grey"><tbody>' + held.map((r) => "<tr><td>" + esc(r.printedName) + '</td><td class="small">' + (r.version === "achievement" ? PLACE_WORD[r.place] + " place · " : "") + esc(r.tableName || "No team") + '</td><td class="small hide-s">' + esc(r.email || "") + '</td><td class="small">Payment not confirmed</td></tr>').join("") + "</tbody></table>" : "") +
      (out.length ? '<div style="padding:12px 16px 0"><h2 style="font-size:14px">Not checked in, no certificate · ' + out.length + '</h2></div><table class="grey"><tbody>' + out.map((r) => "<tr><td>" + esc(r.name) + '</td><td class="small">' + esc(r.tableName || "No team") + '</td><td class="small hide-s">' + esc(r.email || "") + '</td><td class="small">Not checked in</td></tr>').join("") + "</tbody></table>" : "") + "</div>" +
    '<div class="grid" style="margin-top:14px"><div class="card" style="flex:2 1 520px;padding:0;overflow-x:auto"><div style="padding:14px 16px 0"><h2 style="margin:0">Thank-you emails</h2><p class="small" style="margin:4px 0 10px">Judges and mentors/advisers who were checked in, the Lead Sprint Marshal and the check-in desk. No certificate: the email thanks them and carries their feedback link. Facilitators get their feedback link from the Feedback tab.</p></div>' +
      "<table><thead><tr><th></th><th>Name</th><th>Role</th><th class=\"hide-s\">Email</th><th>Status</th></tr></thead><tbody>" +
      th.people.map((p) => '<tr class="' + (p.eligible ? "" : "grey") + '"><td><input type="checkbox" data-ctthx="' + esc(p.key) + '"' + (p.eligible && !p.sentAt ? " checked" : "") + (p.eligible ? "" : " disabled") + ' style="width:18px;height:18px"></td><td>' +
        (p.needsName ? '<input type="text" value="' + esc(p.name) + '" placeholder="Their name" data-ctdesk="' + esc(p.email) + '" style="font:inherit;border:1px solid var(--rule);border-radius:6px;padding:5px 8px;width:160px">' : "<b>" + esc(p.name) + "</b>") +
        '</td><td class="small">' + esc(p.roleLabel) + '</td><td class="small hide-s">' + esc(p.email) + "</td><td>" + (p.sentAt ? '<span class="st confirmed">Sent ' + esc(when(p.sentAt)) + "</span>" : p.why ? '<span class="small">' + esc(p.why) + "</span>" : '<span class="st awaiting">Not sent</span>') + "</td></tr>").join("") +
      '</tbody></table><div class="actions" style="padding:0 16px 14px"><button class="btn gold" data-ct="thanks">Send the thank-you to the ticked people</button></div></div>' +
      '<form class="card" id="ctMsg" style="flex:1 1 340px"><h2>The thank-you message</h2><p class="small" style="margin:-4px 0 8px">{first_name} and {role} fill in for each person. Paragraphs are separated by a blank line.</p>' +
        '<label class="fl">Subject<input type="text" name="subject" maxlength="150" value="' + esc(th.message.subject) + '"></label><textarea name="body">' + esc(th.message.body) + "</textarea>" +
        '<div class="actions"><button class="btn">Save</button><button type="button" class="btn ghost" data-ct="thxpv">Preview</button><button type="button" class="link" data-ct="thxreset">Back to the original words</button></div><div id="ctThxPv"></div></form></div>';
}

async function ctSendOne(r) {
  const pdf = await ctPdf(r);
  const pdf2 = r.partId ? ctB64(await ctPdf(ctPart(r))) : undefined;
  return call("cert-send", { ticketId: r.ticketId, hash: r.hash, pdf: ctB64(pdf), pdf2 });
}
async function ctIssue(list, label) {
  if (!list.length) return;
  if (!confirm("Email " + list.length + " " + label + (list.length === 1 ? " certificate?" : " certificates?"))) return;
  let done = 0;
  try {
    await ctLibs();
    for (const r of list) { msg("Sending " + (done + 1) + " of " + list.length + "…", true); await ctSendOne(r); done++; }
    msg(done + (done === 1 ? " certificate sent." : " certificates sent."), true);
  } catch (err) { msg(err.message + (done ? " " + done + " went before this stopped." : "")); }
  loadCerts().catch(() => {});
}

// A zip of every certificate, stored without compression (PDFs are compressed already).
function ctZip(files) {
  const T = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
  const crc = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const parts = [], central = []; let off = 0;
  const u16 = (v) => [v & 255, (v >>> 8) & 255], u32 = (v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  for (const f of files) {
    const name = new TextEncoder().encode(f.name), c = crc(f.data), sz = f.data.length;
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0), ...name]);
    parts.push(local, f.data);
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0x21), ...u32(c), ...u32(sz), ...u32(sz), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off), ...name]));
    off += local.length + sz;
  }
  const cdSize = central.reduce((n, x) => n + x.length, 0);
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

document.addEventListener("click", async (e) => {
  const el = (s) => e.target.closest(s);
  if (!el("#certsView")) return;
  try {
    if (el("[data-ct=confirm]")) {
      const vals = [0, 1, 2].map((i) => $('[data-ctplace="' + i + '"]').value);
      if (vals.some((v) => v === "")) return msg("Choose a team for first, second and third.");
      const top = vals.map(Number);
      if (new Set(top).size !== 3) return msg("Choose three different teams.");
      const names = top.map((t) => ctData.proposed.tables.find((x) => x.index === t).name);
      if (!confirm("Confirm results: 1st " + names[0] + ", 2nd " + names[1] + ", 3rd " + names[2] + "?")) return;
      ctData = await call("cert-results", { top }); msg("Results confirmed.", true); return loadCerts();
    }
    if (el("[data-ct=unconfirm]")) {
      if (!confirm("Change the results? Achievement certificates already sent would need resending if the order changes.")) return;
      await call("cert-results", { clear: true }); return loadCerts();
    }
    if (el("[data-ctsigrm]")) { if (!confirm("Remove this signature?")) return; await call("cert-signature", { who: el("[data-ctsigrm]").dataset.ctsigrm, remove: true }); ctSigs = null; await ctLibs().catch(() => {}); return loadCerts(); }
    if (el("[data-ctpv]")) {
      const r0 = ctData.rows.find((x) => x.ticketId === Number(el("[data-ctpv]").dataset.ctpv));
      const r = el("[data-ctpv]").dataset.part ? ctPart(r0) : r0;
      const w = window.open("", "_blank");
      const pdf = await ctPdf(r);
      const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
      if (w) w.location = url; else location.href = url;
      return;
    }
    if (el("[data-ctname]")) {
      const r = ctData.rows.find((x) => x.ticketId === Number(el("[data-ctname]").dataset.ctname));
      const name = prompt("The name as it should print on " + r.certId + ". This does not change their ticket.", r.printedName);
      if (name === null || name.trim() === r.printedName) return;
      await call("cert-name", { ticketId: r.ticketId, name }); msg("Name saved." + (r.sentAt ? " Their certificate is now marked changed since sent: resend it." : ""), true); return loadCerts();
    }
    if (el("[data-ctsend]")) {
      const r = ctData.rows.find((x) => x.ticketId === Number(el("[data-ctsend]").dataset.ctsend));
      if (!confirm("Resend " + r.certId + " to " + r.email + "?")) return;
      msg("Sending…", true); await ctSendOne(r); msg("Sent to " + r.email + ".", true); return loadCerts();
    }
    if (el("[data-ctissue]")) {
      const kind = el("[data-ctissue]").dataset.ctissue;
      return ctIssue(ctData.rows.filter((r) => r.checkedIn && !r.held && r.version === kind && !r.sentAt), kind === "achievement" ? "Achievement" : "Participation");
    }
    if (el("[data-ctresend]")) {
      const kind = el("[data-ctresend]").dataset.ctresend;
      return ctIssue(ctData.rows.filter((r) => r.checkedIn && !r.held && r.version === kind && r.changed), "changed " + (kind === "achievement" ? "Achievement" : "Participation"));
    }
    if (el("[data-ct=zip]")) {
      const list = ctData.rows.filter((r) => r.checkedIn && !r.held && r.certId);
      const files = [];
      for (const r of list) {
        msg("Making " + (files.length + 1) + "…", true);
        files.push({ name: r.certId + " " + r.printedName.replace(/[^A-Za-z0-9 .'-]/g, "") + ".pdf", data: await ctPdf(r) });
        if (r.partId) files.push({ name: r.partId + " " + r.printedName.replace(/[^A-Za-z0-9 .'-]/g, "") + ".pdf", data: await ctPdf(ctPart(r)) });
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(ctZip(files)); a.download = "QLV-2026-Certificates.zip"; a.click();
      msg(files.length + " certificates in the download.", true); return;
    }
    if (el("[data-ct=thanks]")) {
      const keys = [...document.querySelectorAll("[data-ctthx]:checked")].map((x) => x.dataset.ctthx);
      if (!keys.length) return msg("Tick the people to thank.");
      if (!confirm("Send the thank-you email to " + keys.length + (keys.length === 1 ? " person?" : " people?"))) return;
      const r = await call("thanks-send", { keys }); msg(r.sent + " sent." + (r.failed ? " " + r.failed + " did not go: try them again." : ""), !r.failed); return loadCerts();
    }
    if (el("[data-ct=thxpv]")) {
      const r = await call("thanks-preview");
      $("#ctThxPv").innerHTML = '<div class="small" style="margin:8px 0 6px">' + esc(r.subject) + ' (shown for a judge called Amina Bello; save first to see changes)</div><iframe sandbox="" title="Thank-you preview" id="ctThxFrame"></iframe>';
      $("#ctThxFrame").srcdoc = r.html; return;
    }
    if (el("[data-ct=thxreset]")) { if (!confirm("Go back to the original thank-you words?")) return; await call("thanks-message", { reset: true }); return loadCerts(); }
  } catch (err) { msg(err.message); }
});
document.addEventListener("change", async (e) => {
  const f = e.target.closest("[data-ctsig]");
  if (f && f.files[0]) {
    const file = f.files[0];
    if (file.type !== "image/png") return msg("Upload the signature as a PNG file.");
    const image = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(file); });
    try { await call("cert-signature", { who: f.dataset.ctsig, image }); ctSigs = null; msg("Signature saved.", true); await ctLibs().catch(() => {}); loadCerts(); } catch (err) { msg(err.message); }
  }
  const d = e.target.closest("[data-ctdesk]");
  if (d) { try { await call("thanks-desk-name", { email: d.dataset.ctdesk, name: d.value }); msg("Name saved.", true); loadCerts(); } catch (err) { msg(err.message); } }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id !== "ctMsg") return;
  e.preventDefault();
  try { await call("thanks-message", { subject: e.target.subject.value, body: e.target.body.value }); msg("Message saved.", true); loadCerts(); } catch (err) { msg(err.message); }
});
`;
