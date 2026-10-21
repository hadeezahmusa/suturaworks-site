// Admin pages for Tables, Partners, Staff, Badge export and Money: markup, styles and
// browser code. Layout and copy follow the mockups in the admin build spec.
// Admin only; verifiers never receive this. Uses the helpers defined in the
// main admin script ($, esc, call, msg, when, naira).

import { MONEY_STYLE, MONEY_HTML, MONEY_JS } from "./money-views.js";

export const VIEWS_STYLE = MONEY_STYLE + String.raw`
.tabs{flex-wrap:wrap;column-gap:16px}
td.mono,#eRows td:nth-child(5){white-space:nowrap}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:0 0 14px}
.tile{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px}.tile span{display:block;font-size:11px;color:var(--mute)}.tile b{font-size:24px}
.tile.gold{background:var(--yel);border-color:var(--yel)}.tile.gold span{color:var(--ink)}
.key{display:flex;flex-wrap:wrap;gap:8px 18px;font-size:11px;color:var(--body);margin:0 0 14px;align-items:center}
.key i{width:22px;height:22px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:11px;margin-right:6px;box-sizing:border-box;vertical-align:middle}
.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}
.tcard{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px}.tcard.next{border:2px solid var(--yel)}
.tcard h2{margin:0;font-size:15px}.tag{font-size:10px;font-weight:700;padding:3px 7px;border-radius:5px;margin-left:6px}.tag.new{background:#F5E6E1;color:#B3402D}.tag.nx{background:#FFF3CF;color:var(--ink)}
.round{position:relative;width:250px;height:250px;margin:0 auto}
.round .mid{position:absolute;left:69px;top:69px;width:112px;height:112px;border-radius:999px;background:var(--panel);border:1px solid var(--line);display:flex;flex-direction:column;align-items:center;justify-content:center}
.round .mid b{font-size:24px;line-height:1}.round .mid span{font-size:11px;color:var(--mute)}
.seat{position:absolute;width:34px;height:34px;border-radius:999px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.seat.empty{background:#fff;border:1.5px dashed var(--rule);color:var(--mute);font-weight:400}
.mix{border-top:1px solid var(--line);padding-top:8px;font-size:11px;color:var(--mute)}
.flag{background:#F5E6E1;border-radius:8px;padding:10px 12px;margin:0 0 8px}.flag b{color:#B3402D;font-size:12px;display:block}.flag span{font-size:11px;color:var(--body)}
.okbox{background:#E2F2F2;color:#19646D;border-radius:8px;padding:10px 12px;font-size:12px;font-weight:600}
.feed div{display:flex;gap:8px;align-items:center;font-size:12px;margin:0 0 6px}
.lvl{display:flex;justify-content:space-between;width:100%;text-align:left;font:inherit;font-size:13px;padding:10px 12px;border-radius:7px;border:1px solid var(--line);background:#fff;cursor:pointer;margin:0 0 6px}
.lvl.on{border:2px solid var(--navy);background:var(--panel);font-weight:700}
.sumtile{background:var(--yel);border-radius:8px;padding:10px 12px;margin:6px 0 10px}.sumtile span{display:block;font-size:11px}.sumtile b{font-size:15px}
.pill{font-size:10px;font-weight:700;padding:3px 8px;border-radius:5px;white-space:nowrap}.pill.ok{background:#E2F2F2;color:#19646D}.pill.wait{background:#FFF3CF;color:#6B5A1E}.pill.off{background:#EEF0F3;color:var(--mute)}
.seatrow{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;padding:10px 0;border-top:1px solid var(--line);align-items:center}
.badge{width:210px;box-sizing:border-box;background:var(--navy);color:#fff;border-radius:10px;padding:18px 16px;display:flex;flex-direction:column;gap:12px;min-height:290px}
.badge .ev{font-size:11px;font-weight:700;letter-spacing:.14em}.badge .nm{font-size:22px;font-weight:700;line-height:1.25;margin-top:auto;overflow-wrap:anywhere}
.badge .chip{align-self:flex-start;font-size:13px;font-weight:700;padding:5px 11px;border-radius:6px;background:var(--yel);color:var(--ink)}.badge .chip.w{background:#fff}
.badge .rf{font-family:'IBM Plex Mono',monospace;font-size:11px;opacity:.85}
.tk{width:230px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff}.tk .h{background:var(--navy);color:#fff;padding:12px 14px;font-size:11px;font-weight:700;letter-spacing:.12em}
.tk .b{padding:14px;display:flex;flex-direction:column;gap:8px}.tk .b .n{font-size:16px;font-weight:700}
.strip{background:#FFF8E2;border-radius:8px;padding:10px 14px;font-size:12px;display:flex;flex-wrap:wrap;gap:6px 22px;margin:0 0 14px}
input.bn{min-height:34px;padding:5px 8px;font-size:12px}
label.fl{display:block;font-size:11px;font-weight:600;color:var(--body);margin:0 0 10px}label.fl input,label.fl select{margin-top:4px}
select{width:100%;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:10px 12px;min-height:42px;background:#fff}
`;

export const VIEWS_HTML = MONEY_HTML + String.raw`
<div id="tablesView" hidden>
  <p class="small" style="margin:0 0 12px">A seat fills when a payment is verified, or when a partner or sponsored seat is claimed. Only admin sees this page. Nothing here reaches participants.</p>
  <div class="tiles" id="tTiles"></div>
  <div class="key" id="tKey"></div>
  <div class="grid"><div class="list" style="flex:3 1 600px"><div class="tgrid" id="tGrid"></div></div>
    <div class="side" style="flex:1 1 300px">
      <div class="card" style="margin:0 0 14px"><h2>Flags</h2><div id="tFlags"></div></div>
      <div class="card" style="margin:0 0 14px"><h2>Latest seats filled</h2><div class="feed" id="tFeed"></div></div>
      <div class="card" style="background:var(--panel)"><h2>Before the day</h2>
        <div class="actions" style="flex-direction:column"><button class="btn" data-goto="export">Export tables, names and ticket numbers</button><button class="btn ghost" data-lock="1">Lock tables when registration closes</button></div>
        <p class="small" id="tLock" style="margin:0"></p>
        <p class="small" style="margin:6px 0 0">A refund empties its seat. Seats are never reshuffled when new people join.</p></div>
    </div></div>
</div>

<div id="partnersView" hidden>
  <p class="small" style="margin:0 0 12px">Partners never register themselves. You add the partner, confirm it, and each person they send claims their own seat with a link.</p>
  <div class="grid">
    <div class="list" style="flex:3 1 560px">
      <div class="card" style="padding:0;overflow-x:auto;margin:0 0 14px"><div style="padding:14px 16px 0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><h2>All partners</h2><span class="small" id="pIncome"></span></div>
        <table><thead><tr><th>Partner</th><th>Level</th><th>Investment</th><th>Status</th><th>Seats claimed</th></tr></thead><tbody id="pRows"></tbody></table></div>
      <div id="pDetail"></div>
    </div>
    <div class="side" style="flex:1 1 320px">
      <form class="card" id="pForm"><h2>Add a partner</h2>
        <label class="fl">Partner organisation<input type="text" name="name" placeholder="Organisation name" required></label>
        <div class="small" style="font-weight:600;margin:0 0 6px">Level</div><div id="pLevels"></div>
        <div class="sumtile"><span>Fills in from the level</span><b id="pSum"></b></div>
        <label class="fl">Contact person<input type="text" name="contactName" placeholder="Who receives the claim links" required></label>
        <label class="fl">Contact email<input type="email" name="contactEmail" placeholder="name@organisation.com" required></label>
        <button class="btn" style="width:100%">Create partner</button>
        <p class="small" style="margin:8px 0 0">The partner starts as awaiting payment. Mark it confirmed once you have checked the payment. The claim links go out then.</p>
      </form>
      <div class="note"><b>What a claimed seat becomes</b><br>A normal ticket with its own reference, linked to the partner. It takes a table when claimed. The badge shows the person's name and table only, never the partner level.</div>
    </div>
  </div>
</div>

<div id="staffView" hidden>
  <p class="small" style="margin:0 0 12px">Facilitators, advisers and judges. Nobody here sits at a table. Their badge shows their role instead.</p>
  <div class="grid">
    <form class="card" id="sForm" style="flex:1 1 340px"><h2>Register a facilitator</h2>
      <label class="fl">Full name<input type="text" name="name" placeholder="As on their ID" required></label>
      <label class="fl">Name to print on the badge<input type="text" name="badgeName" id="sBadge" placeholder="How it should appear"></label>
      <label class="fl">Email<input type="email" name="email" placeholder="Where the ticket is sent" required></label>
      <label class="fl">Days<select name="days"><option value="both">Both days</option><option value="sat">Saturday 7 November only</option><option value="fri">Friday 6 November only</option></select></label>
      <button class="btn" style="width:100%">Register and send ticket</button>
    </form>
    <div style="flex:1 1 420px"><div class="small" style="font-weight:600;margin:0 0 8px">Generated when you register</div>
      <div style="display:flex;flex-wrap:wrap;gap:16px">
        <div class="tk"><div class="h">JCI ASO · QLV 2026 · TICKET</div><div class="b"><span class="small">Admit</span><span class="n sName">[Name on badge]</span><span class="mono">QLV26-F··</span><span class="pill wait" style="align-self:flex-start">Facilitator</span></div></div>
        <div class="badge"><span class="ev">JCI ASO · QLV 2026</span><span class="nm sName">[Name on badge]</span><span class="chip">Facilitator</span><span class="rf">QLV26-F··</span></div>
      </div>
      <p class="small">Same ticket as everyone else, with a reference starting QLV26-F. The badge has a role where participants have a table.</p></div>
  </div>
  <div class="card" style="padding:0;overflow-x:auto;margin-top:14px"><div style="padding:14px 16px 0;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px"><h2>Everyone on staff</h2><span class="small">Advisers and judges come in from the sign-up page and are confirmed there.</span></div>
    <table><thead><tr><th>Name</th><th>Role</th><th>How they came in</th><th>Status</th><th>Reference</th></tr></thead><tbody id="sRows"></tbody></table></div>
</div>

<div id="exportView" hidden>
  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px;margin:0 0 12px">
    <div><h1>Badge export</h1><p class="small" style="margin:4px 0 0">One row per person, ready for printing badges. Email and phone are never in this file.</p></div>
    <div class="actions" style="margin:0"><a class="btn ghost" href="/admin/export/badges.csv" style="text-decoration:none;display:inline-flex;align-items:center">Download CSV</a><button class="btn" data-lock="1">Lock tables and stamp this export</button></div>
  </div>
  <div class="strip" id="eStrip"></div>
  <div class="grid">
    <div class="list card" style="flex:3 1 640px;overflow-x:auto"><h2>What the file contains</h2>
      <table style="min-width:760px"><thead><tr><th>Name</th><th>Badge name</th><th>Table</th><th>Seat</th><th>Ticket</th><th>Type</th><th>Organisation</th><th>Days</th></tr></thead><tbody id="eRows"></tbody></table>
      <ul class="small" style="padding-left:18px"><li>Badge name is filled from the registered name. Correct it here before printing if someone typed a nickname or a typo. It saves when you leave the box.</li>
      <li>Partner tickets show the type Partner. The partner level is never in the file.</li><li>Facilitators, advisers and judges show their role where the table would be.</li>
      <li>Anyone verified or claimed after the lock goes under late additions, seated by the same rules.</li></ul></div>
    <div class="side" style="flex:1 1 300px"><div class="small" style="font-weight:600;margin:0 0 8px">Badge, as printed</div><div id="eBadges" style="display:flex;flex-wrap:wrap;gap:14px"></div>
      <p class="small">Participants show their table. Staff show their role. Nobody shows a partner level or a ticket price.</p></div>
  </div>
</div>`;

export const VIEWS_JS = MONEY_JS + String.raw`
const VIEWS = { tables: "tablesView", partners: "partnersView", staff: "staffView", export: "exportView", money: "moneyView" };
const TIER_BG = { J: ["var(--yel)", "var(--ink)"], S: ["var(--navy)", "#fff"], C: ["#2C3E58", "#fff"], P: ["#E8E9EC", "var(--ink)"], T: ["#1F5F5B", "#fff"] };
let poll = null, curPartner = null, level = "lead", levels = [];
function showView(tab) {
  Object.entries(VIEWS).forEach(([k, id]) => { $("#" + id).hidden = k !== tab; });
  clearInterval(poll); poll = null;
  const load = { tables: loadTables, partners: loadPartners, staff: loadStaff, export: loadExport, money: loadMoney }[tab];
  if (load) load().catch((err) => msg(err.message));
  if (tab === "tables") poll = setInterval(() => { if (!document.hidden) loadTables().catch(() => {}); }, 15000);
}
function dot(letter, extra) {
  const c = TIER_BG[letter] || ["#ddd", "#000"];
  return '<i style="background:' + c[0] + ";color:" + c[1] + ";" + (letter === "P" ? "border:1px solid var(--rule);" : "") + (extra || "") + '">' + letter + "</i>";
}

async function loadTables() {
  const d = await call("tables");
  const h = d.held;
  $("#tTiles").innerHTML =
    '<div class="tile"><span>Verified seats</span><b>' + d.totals.seated + '</b></div>' +
    '<div class="tile"><span>Tables in use</span><b>' + d.totals.tables + '</b></div>' +
    '<div class="tile"><span>JCI Aso members seated</span><b>' + d.totals.members + '</b></div>' +
    '<div class="tile gold"><span>Next verified seat goes to</span><b>' + esc(d.totals.next) + '</b></div>' +
    '<div class="tile"><span>Held for partners and sponsors, not yet claimed</span><b>' + (h.partner + h.sponsored) + '</b><span>' + h.partner + " partner · " + h.sponsored + " sponsored</span></div>";
  $("#tKey").innerHTML = ["J JCI Aso member", "S Standard", "C Corporate", "P Sponsored", "T Partner"].map((x) => "<span>" + dot(x[0]) + x.slice(2) + "</span>").join("") +
    '<span><i style="border:1.5px dashed var(--rule);color:var(--mute);font-weight:400">4</i>Empty seat</span>' +
    '<span><i style="border:3px solid #2F6F4E;background:#2C3E58"></i>Coloured ring: same organisation</span>' +
    '<span><i style="border:3px solid #B3402D;background:var(--navy)"></i>Red ring: two from one organisation share a table</span>';
  $("#tGrid").innerHTML = d.tables.map((t) => {
    const seats = t.seats.map((s, k) => {
      const a = (-90 + k * 45) * Math.PI / 180;
      const pos = "left:" + Math.round(125 + 92 * Math.cos(a) - 17) + "px;top:" + Math.round(125 + 92 * Math.sin(a) - 17) + "px;";
      if (!s.letter) return '<span class="seat empty" style="' + pos + '" title="Seat ' + s.n + ', empty">' + s.n + "</span>";
      const c = TIER_BG[s.letter] || ["#ddd", "#000"];
      const border = s.ring ? "border:3px solid " + s.ring + ";" : s.letter === "P" ? "border:1px solid var(--rule);" : "";
      return '<span class="seat" style="' + pos + "background:" + c[0] + ";color:" + c[1] + ";" + border + '" title="Seat ' + s.n + ", " + esc(s.tier) + ', verified">' + s.letter + "</span>";
    }).join("");
    return '<article class="tcard' + (t.next ? " next" : "") + '"><div style="display:flex;justify-content:space-between;align-items:center;gap:6px"><h2>' + esc(t.name) +
      (t.added ? '<span class="tag new">Added automatically</span>' : "") + (t.next ? '<span class="tag nx">Next seat</span>' : "") + '</h2><span class="small" style="font-weight:700">' + t.count + ' of 8</span></div>' +
      '<div class="round"><div class="mid"><b>' + t.count + '</b><span>seated</span></div>' + seats + '</div><div class="mix">' + t.mix + "</div></article>";
  }).join("");
  $("#tFlags").innerHTML = d.flags.length ? d.flags.map((f) => '<div class="flag"><b>' + esc(f.title) + "</b><span>" + esc(f.text) + "</span></div>").join("")
    : '<div class="okbox">Nothing needs your attention. Nobody shares a table with someone from their organisation.</div>';
  $("#tFeed").innerHTML = d.feed.length ? d.feed.map((e) => "<div>" + dot(e.letter, "width:22px;height:22px;flex-shrink:0;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:11px") + esc(e.text) + "</div>").join("") : '<p class="small">No seats filled yet.</p>';
  $("#tLock").textContent = d.lock ? "Last locked " + when(d.lock.created_at) + " by " + d.lock.created_by + ". Anyone seated since is a late addition." : "Not locked yet.";
}

async function loadPartners() {
  const d = await call("partners");
  levels = d.levels;
  $("#pIncome").textContent = "Confirmed partner income " + d.income.confirmedText + ". Kept apart from ticket income.";
  $("#pRows").innerHTML = d.partners.map((p) => '<tr data-partner="' + p.id + '"' + (curPartner === p.id ? ' class="sel"' : "") + "><td><b>" + esc(p.name) + "</b></td><td>" + esc(p.levelName.replace(" partner", "")) + "</td><td>" + p.amountText + "</td><td>" +
    (p.status === "confirmed" ? '<span class="pill ok">Confirmed</span>' : '<span class="pill wait">Awaiting payment</span>') + "</td><td>" + (p.status === "confirmed" ? p.claimed + " of " + p.seats_total : "Not yet") + "</td></tr>").join("") ||
    '<tr><td colspan="5" class="small">No partners yet. Add one on the right.</td></tr>';
  drawLevels();
  if (curPartner) openPartner(curPartner).catch(() => {});
}
function drawLevels() {
  $("#pLevels").innerHTML = levels.map((l) => '<button type="button" class="lvl' + (l.id === level ? " on" : "") + '" data-level="' + l.id + '" aria-pressed="' + (l.id === level) + '"><span>' + esc(l.name) + '</span><span style="font-weight:400">' + l.amountText + " · " + l.seats + (l.seats === 1 ? " seat" : " seats") + "</span></button>").join("");
  const l = levels.find((x) => x.id === level);
  if (l) $("#pSum").textContent = l.amountText + " · " + l.seats + (l.seats === 1 ? " seat" : " seats") + ", both days";
}
async function openPartner(id) {
  curPartner = id;
  const d = await call("partner?id=" + id);
  const p = d.partner;
  document.querySelectorAll("#pRows tr").forEach((tr) => tr.classList.toggle("sel", Number(tr.dataset.partner) === id));
  const head = '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px"><div><h2 style="margin:0">' + esc(p.name) + '</h2><span class="small">' + esc(p.levelName.replace(" partner", "")) + " · " + p.amountText + " · " + p.seats_total + (p.seats_total === 1 ? " seat" : " seats") + ", both days · " + (p.status === "confirmed" ? "confirmed" : "awaiting payment") +
    "<br>Contact: " + esc(p.contact_name) + ", " + esc(p.contact_email) + (p.payment_note ? "<br>Payment note: " + esc(p.payment_note) : "") + "</span></div>" +
    (p.status === "confirmed" ? '<button class="btn ghost" data-presend="">Send all unclaimed links again</button>' : "") + "</div>";
  let body;
  if (p.status !== "confirmed") {
    body = '<div class="note">Check the payment of <b>' + p.amountText + '</b> on the statement, then confirm. The ' + p.seats_total + (p.seats_total === 1 ? " claim link goes" : " claim links go") + " to " + esc(p.contact_email) + ' in one email.</div>' +
      '<input type="text" id="pNote" placeholder="Payment note, for example the transfer reference and date"><div class="actions"><button class="btn teal" data-pconfirm="">Mark payment confirmed and send the links</button></div>';
  } else {
    body = d.seats.map((s) => '<div class="seatrow"><div><b>Seat ' + s.seat_no + "</b><div class=\"small\">" +
      (s.state === "claimed" ? esc(s.name) + " · " + esc(s.ref) + (s.table ? " · " + esc(s.table) : "") : s.state === "cancelled" ? esc(s.name) + " · cancelled" : (s.sent_at ? "Link sent " + when(s.sent_at) + ", not yet claimed" : "Not sent yet")) + "</div></div>" +
      (s.state === "waiting" ? '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span class="pill wait">Waiting</span><button class="link" data-pcopy="' + esc(s.url) + '">Copy link</button><button class="link" data-presend="' + s.id + '">Resend</button><button class="link" data-pvoid="' + s.id + '">Void link</button></div>'
        : '<span class="pill ' + (s.state === "claimed" ? "ok" : "off") + '">' + (s.state === "claimed" ? "Claimed" : "Cancelled") + "</span>") + "</div>").join("");
  }
  $("#pDetail").innerHTML = '<div class="card" style="border:2px solid var(--navy)">' + head + '<div class="hr"></div>' + body + "</div>";
}

async function loadStaff() {
  const d = await call("staff");
  $("#sRows").innerHTML = d.staff.map((p) => "<tr><td><b>" + esc(p.name) + "</b></td><td>" + esc(p.role) + "</td><td>" + esc(p.source) + '</td><td><span class="pill ' + (p.status === "Registered" ? "ok" : "wait") + '">' + esc(p.status) + '</span></td><td class="mono">' + esc(p.ref) + "</td></tr>").join("") ||
    '<tr><td colspan="5" class="small">Nobody yet.</td></tr>';
}

async function loadExport() {
  const d = await call("export");
  const s = d.strip;
  $("#eStrip").innerHTML = "<span><b>Snapshot:</b> " + (d.lock ? when(d.lock.created_at) + " by " + esc(d.lock.created_by) : "not locked yet") + "</span>" +
    "<span><b>People:</b> " + s.participants + " participants, " + s.facilitators + " facilitators, " + s.advisers + " advisers, " + s.judges + " judges</span>" +
    "<span><b>Late additions:</b> " + (s.late || "none yet") + "</span>" +
    "<span><b>Left out, not yet claimed:</b> " + d.held.partner + " partner and " + d.held.sponsored + " sponsored seats</span>";
  let lateShown = false;
  $("#eRows").innerHTML = d.rows.map((r) => {
    let pre = "";
    if (r.late && !lateShown) { lateShown = true; pre = '<tr><td colspan="8" style="background:#FFF8E2;font-weight:700;font-size:12px">Late additions, after the lock</td></tr>'; }
    return pre + "<tr><td><b>" + esc(r.name) + '</b></td><td><input class="bn" data-badge="' + r.id + '" value="' + esc(r.badge) + '" aria-label="Badge name for ' + esc(r.name) + '"></td><td>' + esc(r.table) + "</td><td>" + esc(r.seat) + '</td><td class="mono">' + esc(r.ref) + "</td><td>" + esc(r.type) + "</td><td>" + esc(r.org) + "</td><td>" + esc(r.days) + "</td></tr>";
  }).join("") || '<tr><td colspan="8" class="small">Nobody seated yet.</td></tr>';
  const part = d.rows.find((r) => !r.staff), staff = d.rows.find((r) => r.staff);
  const badge = (r, isStaff) => '<div class="badge"><span class="ev">JCI ASO · QLV 2026</span><span class="nm">' + esc(r ? r.badge : isStaff ? "[Staff name]" : "[Name]") + '</span><span class="chip' + (isStaff ? " w" : "") + '">' + esc(r ? r.table : isStaff ? "Judge" : "Foundation") + '</span><span class="rf">' + esc(r ? r.ref + (isStaff ? "" : " · seat " + r.seat) : "QLV26-···") + "</span></div>";
  $("#eBadges").innerHTML = badge(part, false) + badge(staff, true);
}

document.addEventListener("click", async (e) => {
  const el = (s) => e.target.closest(s);
  try {
    if (el("[data-goto]")) { document.querySelector('[data-tab="' + el("[data-goto]").dataset.goto + '"]').click(); return; }
    if (el("[data-lock]")) {
      if (!confirm("Lock the tables and stamp this export now? Seating carries on, but anyone seated after this shows as a late addition.")) return;
      await call("lock", {}); msg("Locked and stamped.", true);
      if (!$("#tablesView").hidden) loadTables(); else loadExport();
      return;
    }
    if (el("[data-level]")) { level = el("[data-level]").dataset.level; drawLevels(); return; }
    if (el("tr[data-partner]")) { await openPartner(Number(el("tr[data-partner]").dataset.partner)); return; }
    if (el("[data-pconfirm]") !== null && el("[data-pconfirm]")) {
      if (!confirm("Mark this partner's payment as confirmed and email the claim links to the contact?")) return;
      await call("partner-confirm", { id: curPartner, note: $("#pNote").value }); msg("Confirmed. The claim links have gone to the contact.", true); loadPartners(); return;
    }
    if (el("[data-presend]")) {
      const id = el("[data-presend]").dataset.presend;
      if (!confirm(id ? "Email this seat's link to the contact again?" : "Email every unclaimed link to the contact again?")) return;
      await call("partner-resend", { id: curPartner, seatId: id || undefined }); msg("Sent.", true); openPartner(curPartner); return;
    }
    if (el("[data-pvoid]")) {
      if (!confirm("Void this link? It stops working at once and a new link replaces it. Send the new one with Resend.")) return;
      await call("partner-void", { seatId: el("[data-pvoid]").dataset.pvoid }); msg("Old link voided. A new link is ready.", true); openPartner(curPartner); return;
    }
    if (el("[data-pcopy]")) { navigator.clipboard.writeText(el("[data-pcopy]").dataset.pcopy); el("[data-pcopy]").textContent = "Copied"; return; }
    if (el("[data-cancel]")) {
      const b = el("[data-cancel]");
      if (!confirm("Cancel " + b.dataset.name + "'s ticket? Their ticket stops working and their seat is freed. Nobody else moves. This cannot be undone.")) return;
      renderDetail(await call("cancel-ticket", { id: Number(b.dataset.cancel) })); msg("Ticket cancelled and seat freed.", true); loadList(); return;
    }
  } catch (err) { msg(err.message); }
});
document.addEventListener("change", async (e) => {
  const inp = e.target.closest("[data-badge]");
  if (!inp) return;
  try { const r = await call("badge-name", { id: Number(inp.dataset.badge), badge: inp.value }); inp.value = r.badge; msg("Badge name saved.", true); } catch (err) { msg(err.message); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "sBadge" || (e.target.closest("#sForm") && e.target.name === "name")) {
    const f = $("#sForm"); const v = f.badgeName.value.trim() || f.name.value.trim() || "[Name on badge]";
    document.querySelectorAll(".sName").forEach((x) => { x.textContent = v; });
  }
});
document.addEventListener("submit", async (e) => {
  if (e.target.id === "pForm") {
    e.preventDefault();
    const f = e.target;
    try { const d = await call("partner", { name: f.name.value, level, contactName: f.contactName.value, contactEmail: f.contactEmail.value }); f.reset(); msg("Partner created, awaiting payment.", true); curPartner = d.partner.id; loadPartners(); }
    catch (err) { msg(err.message); }
  }
  if (e.target.id === "sForm") {
    e.preventDefault();
    const f = e.target;
    if (!confirm("Register " + f.name.value + " as a facilitator and email their ticket to " + f.email.value + "?")) return;
    try { const d = await call("facilitator", { name: f.name.value, badgeName: f.badgeName.value, email: f.email.value, days: f.days.value }); msg("Registered " + d.ref + (d.emailed ? " and the ticket has gone out." : ". Their place is saved, but the ticket email did not send. Send them their reference " + d.ref + " yourself."), d.emailed); f.reset(); document.querySelectorAll(".sName").forEach((x) => { x.textContent = "[Name on badge]"; }); loadStaff(); }
    catch (err) { msg(err.message); }
  }
});
`;
