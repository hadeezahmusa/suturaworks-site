// The On screen tab: who is thanked on the projector, their logos, and the
// JCI Aso members' businesses listed free. Admin only. Uses the helpers in
// the main admin script ($, esc, call, msg).

export const SCREEN_STYLE = String.raw`
#scRows td{vertical-align:middle}
.sc-logo{width:96px;height:56px;background:#fff;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sc-logo img{max-width:84px;max-height:44px;object-fit:contain}.sc-logo span{font-size:10px;color:var(--mute);text-align:center;padding:4px}
.sc-name{display:flex;gap:6px;align-items:center}.sc-name input{min-width:0;flex:1 1 160px;padding:7px 9px;font:inherit;border:1px solid var(--rule);border-radius:6px}
.sc-off{opacity:.55}
.sc-size{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mute);white-space:nowrap}
#scPreview{background:linear-gradient(160deg,#0A1F4D,#07183B);border-radius:10px;aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4%;padding:4%;overflow:hidden}
#scPreview .t{color:#EFC22D;font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase}
#scPreview .w{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 8px}
#scPreview .w i{background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;color:#0F2B63;text-align:center;line-height:1.1;overflow:hidden}
#scPreview .w img{max-width:86%;max-height:78%;object-fit:contain}
`;

export const SCREEN_HTML = String.raw`
<div id="screenView" hidden>
  <p class="small" style="margin:0 0 12px">Everyone listed here is thanked on the projector during arrival, with their logo if you add one. Bigger support gets a bigger logo. Anyone without a logo shows as their name.</p>
  <div class="grid">
    <div class="list" style="flex:3 1 600px">
      <div class="card" style="padding:0;overflow-x:auto;margin:0 0 14px"><div style="padding:14px 16px 0"><h2>On the thank-you slide</h2></div>
        <table><thead><tr><th>Logo</th><th>Name on screen</th><th>Group</th><th>Size</th><th></th></tr></thead><tbody id="scRows"></tbody></table></div>
      <input type="file" id="scFile" accept="image/png,image/jpeg" hidden>
    </div>
    <div class="side" style="flex:1 1 320px">
      <form class="card" id="scForm"><h2>Add a JCI Aso member's business</h2>
        <label class="fl">Business name<input type="text" name="name" maxlength="120" placeholder="As it should appear on screen" required></label>
        <label class="fl">JCI Aso member <span class="small" style="font-weight:400">(optional, for your records)</span><input type="text" name="owner" maxlength="120" placeholder="Whose business it is"></label>
        <label class="fl">Logo <span class="small" style="font-weight:400">(optional, you can add it later)</span><input type="file" name="logo" accept="image/png,image/jpeg"></label>
        <button class="btn" style="width:100%">Add business</button>
        <p class="small" style="margin:8px 0 0">Members' businesses are listed free and show at the small size.</p>
      </form>
      <div class="card"><h2>Preview</h2><div id="scPreview"></div><p class="small" style="margin:8px 0 0">A rough guide. On the day the logos drift gently in place, and a long list splits across two or more slides.</p></div>
      <div class="note"><b>Sizes</b><br>Lead partner, or a sponsor who paid ₦200,000 or more: largest. Supporting partner, or ₦100,000 or more: large. Community partner and other sponsors: medium. Members' businesses: small.<br><br><b>Logos</b><br>PNG or JPG up to 1MB. A PNG with a transparent background looks best. Each logo sits on a white tile on screen.</div>
    </div>
  </div>
</div>`;

export const SCREEN_JS = String.raw`
let screenData = null, screenUploadKey = null;
const SC_GROUP = { partner: "Partner", sponsor: "Sponsored seats", member: "Member's business" };
async function loadScreen(d) {
  screenData = d || await call("screen");
  $("#scRows").innerHTML = screenData.entries.map((e) => '<tr class="' + (e.live ? "" : "sc-off") + '" data-sc="' + esc(e.key) + '">' +
    '<td><div class="sc-logo">' + (e.logo ? '<img alt="" src="' + esc(e.logo) + '">' : "<span>No logo yet</span>") + "</div></td>" +
    '<td><div class="sc-name"><input type="text" value="' + esc(e.name) + '" maxlength="120" aria-label="Name on screen"' + (e.registered ? ' placeholder="' + esc(e.registered) + '"' : "") + '><button class="link" data-scsave="1">Save</button></div>' +
    '<div class="small">' + esc(e.detail) + (e.why ? " · <b>" + esc(e.why) + "</b>" : "") + "</div></td>" +
    "<td>" + SC_GROUP[e.source] + '</td><td><span class="sc-size">' + e.sizeLabel + "</span></td>" +
    '<td style="white-space:nowrap"><button class="link" data-scup="1">' + (e.logo ? "Replace logo" : "Upload logo") + "</button>" +
    (e.logo ? ' · <button class="link" data-scnologo="1">Remove logo</button>' : "") +
    (e.source === "member" ? ' · <button class="link" data-scdel="1">Remove</button>' : "") + "</td></tr>").join("") ||
    '<tr><td colspan="5" class="small">Nobody yet. Partners and sponsors appear here when you add them, and you can add members\' businesses on the right.</td></tr>';
  const live = screenData.entries.filter((e) => e.live).sort((a, b) => b.size - a.size);
  const px = { 4: [64, 34], 3: [52, 28], 2: [42, 22], 1: [32, 18] };
  $("#scPreview").innerHTML = '<span class="t">With thanks to our partners and sponsors</span><div class="w">' + live.slice(0, 24).map((e) =>
    '<i style="width:' + px[e.size][0] + "px;height:" + px[e.size][1] + "px;font-size:" + (4 + e.size) + 'px">' + (e.logo ? '<img alt="" src="' + esc(e.logo) + '">' : esc(e.name)) + "</i>").join("") + "</div>";
}
async function scUpload(key, file) {
  const res = await fetch("/admin/logo?key=" + encodeURIComponent(key), { method: "POST", credentials: "same-origin", headers: { "x-admin": "1", "content-type": file.type || "application/octet-stream" }, body: file });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "The logo did not upload.");
  return data;
}
$("#scRows").addEventListener("click", async (e) => {
  const tr = e.target.closest("tr[data-sc]");
  if (!tr) return;
  const key = tr.dataset.sc;
  try {
    if (e.target.closest("[data-scsave]")) { await loadScreen(await call("screen-save", { key, name: tr.querySelector("input").value })); msg("Saved.", true); }
    else if (e.target.closest("[data-scup]")) { screenUploadKey = key; $("#scFile").value = ""; $("#scFile").click(); }
    else if (e.target.closest("[data-scnologo]")) { if (confirm("Remove this logo? The name shows instead.")) { await loadScreen(await call("screen-logo-remove", { key })); msg("Logo removed.", true); } }
    else if (e.target.closest("[data-scdel]")) { if (confirm("Take this business off the thank-you slide?")) { await loadScreen(await call("screen-member-remove", { key })); msg("Removed.", true); } }
  } catch (err) { msg(err.message); }
});
$("#scFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file || !screenUploadKey) return;
  try { await loadScreen(await scUpload(screenUploadKey, file)); msg("Logo uploaded.", true); } catch (err) { msg(err.message); }
});
$("#scForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget, btn = f.querySelector("button"), file = f.logo.files[0];
  btn.disabled = true;
  try {
    const d = await call("screen-member", { name: f.name.value, owner: f.owner.value });
    if (file) {
      try { await loadScreen(await scUpload(d.key, file)); }
      catch (err) { await loadScreen(); msg("Business added, but the logo did not upload: " + err.message + " Try Upload logo on its row."); f.reset(); return; }
    } else await loadScreen(d);
    f.reset();
    msg("Business added.", true);
  } catch (err) { msg(err.message); } finally { btn.disabled = false; }
});
`;
