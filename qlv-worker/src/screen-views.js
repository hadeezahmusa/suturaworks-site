// The On screen tab: who is thanked on the projector, their logos, and the
// JCI Aso members' businesses listed free. Admin only. Uses the helpers in
// the main admin script ($, esc, call, msg).

export const SCREEN_STYLE = String.raw`
#scRows td{vertical-align:middle}
.sc-logo{width:96px;height:56px;background:#0F2B63;border:1px solid var(--line);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.sc-logo img{max-width:84px;max-height:44px;object-fit:contain}.sc-logo span{font-size:10px;color:#C9D6EC;text-align:center;padding:4px}
.sc-name{display:flex;gap:6px;align-items:center}.sc-name input{min-width:0;flex:1 1 160px;padding:7px 9px;font:inherit;border:1px solid var(--rule);border-radius:6px}
.sc-off{opacity:.55}
.sc-size{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mute);white-space:nowrap}
#scPreview{background:linear-gradient(160deg,#0A1F4D,#07183B);border-radius:10px;aspect-ratio:16/9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4%;padding:4%;overflow:hidden}
#scPreview .t{color:#EFC22D;font-weight:700;font-size:10px;letter-spacing:2px;text-transform:uppercase}
#scPreview .w{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 8px}
#scPreview .w i{border-radius:4px;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;color:#fff;text-align:center;line-height:1.1;overflow:hidden}
#scPreview .w img{max-width:86%;max-height:78%;object-fit:contain}
`;

export const SCREEN_HTML = String.raw`
<div id="screenView" hidden>
  <p class="small" style="margin:0 0 12px">Everyone listed here with a logo is thanked on the projector during arrival. Names without a logo stay off the display until you upload one. Bigger support gets a bigger logo.</p>
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
      <div class="note"><b>Sizes</b><br>Lead Sponsor, or ₦200,000 or more for sponsored seats: largest. Supporting Sponsor, or ₦100,000 or more: large. Community Sponsor and other sponsored seats: medium. Members' businesses: small, on the Community Sponsors slides.<br><br><b>Logos</b><br>PNG or JPG up to 1MB. Every logo shows in white on the dark screen: the page turns it white as it uploads, dropping a plain background. A logo on a busy or photo background may not come out cleanly.</div>
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
  $("#scPreview").innerHTML = '<span class="t">With thanks to our sponsors</span><div class="w">' + live.slice(0, 24).map((e) =>
    '<i style="width:' + px[e.size][0] + "px;height:" + px[e.size][1] + "px;font-size:" + (4 + e.size) + 'px">' + (e.logo ? '<img alt="" src="' + esc(e.logo) + '">' : esc(e.name)) + "</i>").join("") + "</div>";
}
// Turns a logo white on a transparent background, the way the display
// shows it: the colour of the edges is taken as the background, and each
// pixel's distance from it becomes how solid the white is.
async function scWhiten(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / img.width);
  const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h), d = px.data;
  const edge = [];
  for (let x = 0; x < w; x++) edge.push((x) * 4, ((h - 1) * w + x) * 4);
  for (let y = 0; y < h; y++) edge.push((y * w) * 4, (y * w + w - 1) * 4);
  const clear = edge.filter((i) => d[i + 3] < 128).length > edge.length / 2;
  const med = (k) => { const v = edge.map((i) => d[i + k]).sort((a, b) => a - b); return v[v.length >> 1] / 255; };
  const bg = [med(0), med(1), med(2)];
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const al = d[i + 3] / 255;
    let ink = al;
    if (!clear) {
      const dist = Math.sqrt(((d[i] / 255 - bg[0]) ** 2 + (d[i + 1] / 255 - bg[1]) ** 2 + (d[i + 2] / 255 - bg[2]) ** 2) / 3);
      ink = Math.min(1, Math.max(0, (dist - 0.09) / 0.46)) * al;
    }
    d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(ink * 255);
    if (ink > 0.08) { const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error("Nothing showed up in that logo. Try a version on a plain background.");
  g.putImageData(px, 0, 0);
  const out = document.createElement("canvas"); out.width = x1 - x0 + 21; out.height = y1 - y0 + 21;
  out.getContext("2d").drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 10, 10, x1 - x0 + 1, y1 - y0 + 1);
  return new Promise((ok) => out.toBlob(ok, "image/png"));
}
async function scUpload(key, file) {
  file = await scWhiten(file);
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
