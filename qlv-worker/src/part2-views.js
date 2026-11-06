// Admin screens for part 2: Rebalance, Check-in, Briefings, Scoring, Stage and
// Settings. Sutura Works admin look, same helpers as the rest of the admin
// ($, esc, call, msg, when). Written without template literals inside the
// browser code, because the whole script is itself a template string.

export const P2_STYLE = String.raw`
.seg{display:inline-flex;border:1px solid var(--rule);border-radius:8px;overflow:hidden}.seg button{font:inherit;font-size:12px;font-weight:600;border:0;background:#fff;padding:9px 12px;cursor:pointer;color:var(--body);min-height:40px}
.seg button.on{background:var(--navy);color:#fff}
.opt{font:inherit;text-align:left;display:flex;flex-direction:column;gap:6px;padding:14px;min-height:120px;border-radius:10px;cursor:pointer;color:var(--ink);background:#fff;border:1px solid var(--line);flex:1 1 260px}
.opt.on{border:2px solid var(--navy)}.opt b{font-size:14px}.opt span{font-size:12px;color:var(--body);line-height:1.5}.opt em{font-style:normal;font-size:12px;font-weight:700;color:var(--teal)}
td.changed{font-weight:700;background:#FFF8E2}
.switch{font:inherit;display:inline-flex;align-items:center;gap:10px;padding:6px 14px 6px 6px;min-height:44px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:700;color:var(--ink);border:1px solid var(--rule);background:#fff}
.switch i{width:40px;height:24px;border-radius:999px;background:#C6D4E6;position:relative;display:inline-block}.switch i::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:999px;background:#fff;transition:left .15s}
.switch[aria-checked=true]{background:#E2F2F2}.switch[aria-checked=true] i{background:#19646D}.switch[aria-checked=true] i::after{left:19px}
.person{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}.person b{display:block}
.arr{font:inherit;font-size:13px;font-weight:700;min-height:44px;min-width:120px;border-radius:7px;cursor:pointer;border:0;background:var(--navy);color:#fff}.arr.on{background:#E2F2F2;color:#19646D;border:1px solid #19646D}
.tcount{display:inline-block;margin:0 6px 6px 0;padding:6px 10px;border-radius:7px;background:var(--panel);font-size:12px}
.rolerow{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;padding:14px 0;border-top:1px solid var(--line)}.rolerow .acts{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-start}
.dialog{border:2px solid var(--navy);background:#fff;border-radius:10px;padding:16px;margin:12px 0}
.cell{display:inline-flex;align-items:center;justify-content:center;min-width:62px;min-height:30px;padding:0 8px;border-radius:6px;font-size:12px}
.cell.score{background:#E2F2F2;color:#19646D;font-weight:700;cursor:pointer;border:0;font-family:inherit}.cell.advised{background:#EEF0F3;color:var(--mute)}.cell.waiting{background:#FFF3CF;color:#6B5A1E}.cell.none{color:var(--mute);border:1px dashed var(--rule)}.cell.unlocked{background:#FBEDEB;color:#8A2A20}
.strip2{background:var(--navy);color:#fff;border-radius:10px;padding:14px 18px;display:flex;flex-wrap:wrap;gap:8px 28px;align-items:center;margin:0 0 14px}.strip2 span{font-size:12px;opacity:.9}
.clockcard{background:var(--navy);color:#fff;border-radius:14px;padding:22px 24px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:16px}
.clockcard .t{font-size:58px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums}.clockcard .l,.clockcard .c{font-size:12px;opacity:.85}
.clockcard .btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.6)}
.phases{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.phases button{font:inherit;font-size:12px;padding:9px 12px;min-height:42px;border-radius:7px;cursor:pointer;border:1px solid var(--line);background:#fff;color:var(--mute)}
.phases button.done{background:#EEF0F3;color:var(--body)}.phases button.on{background:var(--yel);border-color:var(--yel);color:var(--navy);font-weight:700}
.q{display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line);font-size:13px}
.ok2{background:#E2F2F2;color:#19646D;font-size:11px;font-weight:700;padding:5px 9px;border-radius:6px}.no2{background:#FBEDEB;color:#8A2A20;font-size:11px;font-weight:700;padding:5px 9px;border-radius:6px}
.form2 label{display:block;font-size:11px;font-weight:600;color:var(--body);margin:0 0 10px}.form2 input,.form2 select,.form2 textarea{margin-top:4px;width:100%;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:9px 11px;min-height:40px;background:#fff}
.form2 .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.form2 .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
textarea.tpl{font-family:'IBM Plex Mono',Consolas,monospace;font-size:12px;min-height:420px;line-height:1.5}
.miss{background:#FBEDEB;color:#8A2A20;border-radius:8px;padding:10px 12px;font-size:12px;margin:8px 0}
@media(max-width:700px){.form2 .two,.form2 .three{grid-template-columns:1fr}.clockcard .t{font-size:44px}}
`;

export const P2_HTML = String.raw`
<div id="rebalanceView" hidden><div id="rbBox"></div></div>

<div id="checkinView" hidden><div id="ciBox"></div></div>

<div id="briefingsView" hidden>
  <div style="margin:0 0 12px"><h1>Briefings and tasks</h1><p class="small" style="margin:4px 0 0">Generate each role's packs, check them, then send. Every pack opens in the QLV 2026 look.</p></div>
  <div class="card" id="bfLock" style="margin:0 0 14px;display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center"></div>
  <div class="grid">
    <div class="list" style="flex:3 1 620px">
      <div class="card" style="margin:0 0 14px"><h2>Role packs</h2><div id="bfRoles"></div><div id="bfConfirm"></div></div>
      <div class="card" style="margin:0 0 14px;overflow-x:auto"><h2 id="bfPeopleTitle">People</h2><div id="bfPeople"></div></div>
      <div class="card"><h2>Templates</h2><p class="small" style="margin:0 0 10px">The wording of every email, brief and printed sheet. Merge fields are in double braces. Saving marks generated packs as changed.</p>
        <div class="form2"><label>Template<select id="tplPick"></select></label></div>
        <textarea class="tpl" id="tplBody" spellcheck="false"></textarea>
        <div class="actions"><button class="btn" data-tpl="save">Save wording</button><button class="btn ghost" data-tpl="reset">Back to the original</button><span class="small" id="tplNote"></span></div></div>
    </div>
    <div class="side" style="flex:1 1 340px">
      <div class="card" style="margin:0 0 14px"><h2>The six tasks</h2><p class="small" style="margin:0 0 6px">Only admin can see these before the briefs open at 7:00am on Saturday. They are never put in an email. Which table has which task, and the print packs, are on the Tables page.</p><div id="bfTasks"></div></div>
      <div class="card" id="taskEdit" hidden style="margin:0 0 14px"></div>
      <div class="card"><h2>Who does what</h2><p class="small" style="margin:0 0 10px">Mentor routes and judges are on the Staff tab. The Lead Sprint Marshal is marked on the Team rooms tab.</p><button class="btn ghost" data-goto="staff">Open Staff</button></div>
    </div>
  </div>
</div>

<div id="scoringView" hidden>
  <div style="margin:0 0 12px"><h1>Scoring</h1><p class="small" style="margin:4px 0 0">Scores arrive here as judges submit them. Nothing on this page reaches the projector until you press Reveal on the Stage tab.</p></div>
  <div class="strip2" id="scStrip"></div>
  <div class="grid">
    <div class="list card" style="flex:3 1 640px;overflow-x:auto"><h2>Tally, out of 25</h2><div id="scTally"></div>
      <p class="small">"Advised" means that judge mentored the table and does not score it. The average divides by the judges who did score. Click a submitted score to unlock it if a judge made a mistake.</p></div>
    <div class="side" style="flex:1 1 320px">
      <div class="card" style="margin:0 0 14px"><h2>Order so far</h2><p class="small" style="margin:0 0 6px">Admin only. Teams not yet fully scored are left out.</p><div id="scOrder"></div>
        <p class="small">Ties go to the higher "Outlives the team" average, then to the judges.</p></div>
      <div class="card"><h2>Judges</h2><div id="scJudges"></div></div>
    </div>
  </div>
</div>

<div id="stageView" hidden>
  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:12px;margin:0 0 12px">
    <div><h1>Stage</h1><p class="small" style="margin:4px 0 0">Run the projector from here. The display follows whatever you choose.</p></div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><span id="stDisp"></span><a class="btn ghost" id="stDemo" target="_blank" rel="noopener" style="text-decoration:none">Watch the demo</a><button class="btn" data-st="open">Open the display</button></div>
  </div>
  <div class="phases" id="stPhases"></div>
  <div class="grid">
    <div class="list" style="flex:3 1 620px">
      <div class="clockcard" id="stClock"></div>
      <div class="card" style="margin-top:14px"><h2>Presentation order</h2><div id="stQueue"></div></div>
    </div>
    <div class="side" style="flex:1 1 320px">
      <div class="card" style="margin:0 0 14px"><h2>Sound cues</h2>
        <p class="small" style="margin:0 0 4px">Sprint: chime at halfway and at 5 minutes, gong at zero.</p>
        <p class="small" style="margin:0 0 10px">Presentations: 5 minutes each, soft chime at 1 minute, gong at zero. No ticking.</p>
        <button class="btn ghost" data-st="testSound" style="width:100%">Play a test sound on the display</button></div>
      <div class="card" style="margin:0 0 14px;background:#EAF1FB"><h2>Who is speaking</h2><p class="small" style="margin:0 0 10px">Puts the speaker and their logo on the display. It goes off by itself when you move to the next stage.</p><div id="stSpeakers"></div></div>
      <div class="card" style="margin:0 0 14px"><h2>On the display between sessions</h2><div id="stToggles"></div></div>
      <div class="card" id="stJudgesCard" style="margin:0 0 14px"><h2>Judges’ photo</h2><p class="small" style="margin:0 0 10px">Joins the arrival rotation once uploaded. Any photo from your phone or computer, landscape works best.</p><div id="stJudges"></div><input type="file" id="stJudgesFile" accept="image/png,image/jpeg" hidden></div>
      <div class="card" style="background:#FFF8E2"><h2>Results</h2><p class="small" style="margin:0 0 10px">Opens once every score is in. The display shows the top three and the recognitions only. The full table stays on the Scoring tab.</p><div id="stReveal"></div></div>
      <div class="card" id="stResetCard" style="margin-top:14px"><h2>After a rehearsal</h2><p class="small" style="margin:0 0 10px">Puts the stage back to Arrival with no team presented and the results hidden. It can't be used once any judge has submitted a score.</p><button class="btn ghost" data-streset="1" style="width:100%">Reset the stage</button></div>
    </div>
  </div>
</div>

<div id="settingsView" hidden>
  <div style="margin:0 0 12px"><h1>Settings for the day</h1><p class="small" style="margin:4px 0 0">Times are Abuja time. Changes apply straight away.</p></div>
  <div class="grid">
    <form class="list card form2" id="setForm" style="flex:3 1 560px"></form>
    <div class="side" style="flex:1 1 340px">
      <div class="card" style="margin:0 0 14px"><h2>Teams</h2><div id="setTeams"></div></div>
      <div class="card"><h2>Other sign-ins</h2><p class="small" style="margin:0 0 10px">Desk volunteers see only Check-in: names, references and tables. The stage coordinator sees only Stage. They sign in with their email like you do.</p>
        <div id="setAccess"></div>
        <form id="accForm" class="form2" style="margin-top:10px"><label>Email<input type="email" name="email" required placeholder="volunteer@example.com"></label>
          <label>Can see<select name="role"><option value="desk">Check-in desk</option><option value="stage">Stage coordinator</option></select></label><button class="btn" style="width:100%">Add sign-in</button></form></div>
      <div class="card" style="margin-top:14px"><h2>Board view</h2><p class="small" style="margin:0 0 10px">A read-only look round the admin for the board, opened with one passcode. They see registrations, tables, sponsors, staff, scoring, the stage, check-in, badges and money. Emails, phone numbers, proofs of payment, private links, the tasks, member codes and the three answers stay hidden.</p><div id="setBoard"></div></div>
    </div>
  </div>
</div>`;

export const P2_JS = String.raw`
// The projector demo: sample tables and a fast clock, no live data, so
// everyone who can see the Stage tab may open it (the board included).
if ($("#stDemo")) $("#stDemo").href = SITE + "stage.html?demo=1";
let ciFilter = "all";
let rbOpt = "spread", rbData = null, bfData = null, bfRole = "mentor", bfConfirm = null, tplList = [], tplKey = null, stData = null, stTimer = null, stOffset = 0;
const pad = (n) => String(n).padStart(2, "0");
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
const abuja = (iso) => new Date(Date.parse(iso) + 3600000).toISOString().slice(0, 16);

// ---------- Rebalance ----------
async function loadRebalance() {
  const d = rbData = await call("rebalance");
  const box = $("#rbBox");
  let h = '<p style="margin:0 0 8px"><button class="link" data-goto="tables">Back to tables</button></p><h1>Tables at lock</h1>' +
    '<p class="small" style="margin:4px 0 14px">Registration closes, then teams are announced at ' + esc(when(d.teamsAnnouncedAt)) + '. Rebalance before then. After the announcement, nothing moves.</p>';
  h += '<div class="card" style="margin:0 0 14px;display:flex;flex-wrap:wrap;gap:14px;align-items:center"><b>Smallest table allowed</b>' +
    '<div class="seg"><button data-min="-1" aria-label="Lower the minimum">−</button><button disabled style="opacity:1;color:var(--ink)">' + d.min + ' people</button><button data-min="1" aria-label="Raise the minimum">+</button></div>' +
    '<span class="small">' + d.seated + ' people are seated.</span></div>';
  if (d.frozen) { box.innerHTML = h + '<div class="note"><b>Teams have been announced.</b> This page is read only and nobody already seated will move. Anyone seated from now on joins a table with space and is flagged on the Tables page.</div>'; return; }
  if (!d.target) { box.innerHTML = h + '<div class="okbox">Every table has at least ' + d.min + ' people. Nothing to rebalance.</div>'; return; }
  const o = d.options[rbOpt], other = d.options[rbOpt === "spread" ? "even" : "spread"];
  h += '<div class="flag" style="padding:12px 14px;margin:0 0 14px;font-size:13px"><b>' + esc(d.target.name) + ' has ' + d.target.count + (d.target.count === 1 ? ' person' : ' people') + '.</b> That is below the minimum of ' + d.min + '. Choose how to fix it, check the moves, then apply.' +
    (d.closed ? "" : ' <br><span class="small">Registration is still open, so more people may still join this table.</span>') + '</div>';
  const desc = {
    spread: ['Spread them', 'Move ' + esc(d.target.name) + '’s ' + d.target.count + ' to tables with nobody from their organisations. ' + esc(d.target.name) + ' closes.', d.options.spread.tablesAfter + ' tables on the day. The biggest seats ' + d.options.spread.biggest + '.'],
    even: ['Share out evenly', 'Keep ' + esc(d.target.name) + ' and move people into it from the fullest tables until every table is within one of the others.', d.options.even.tablesAfter + ' tables on the day. Needs a task for every table.'],
  };
  h += '<div class="grid"><div class="list" style="flex:3 1 560px"><div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 14px">' +
    ["spread", "even"].map((k) => '<button class="opt' + (k === rbOpt ? " on" : "") + '" data-rbopt="' + k + '" aria-pressed="' + (k === rbOpt) + '"><b>' + desc[k][0] + '</b><span>' + desc[k][1] + '</span><em>' + desc[k][2] + '</em></button>').join("") + '</div>';
  h += '<div class="card" style="padding:0;overflow-x:auto"><div style="padding:14px 16px 0"><h2>Before and after</h2></div><table><thead><tr><th>Table</th><th>Now</th><th>After</th></tr></thead><tbody>' +
    o.rows.map((r) => '<tr style="cursor:default"><td><b>' + esc(r.name) + '</b></td><td>' + r.before + '</td><td class="' + (r.after !== r.before ? "changed" : "") + '">' + (r.after === 0 ? "Closed" : r.after) + '</td></tr>').join("") + '</tbody></table></div></div>';
  h += '<div class="side" style="flex:1 1 320px"><div class="card" style="margin:0 0 14px"><h2>The moves</h2>' +
    o.moves.map((m) => '<div class="person"><b>' + esc(m.name) + '</b><span class="small">' + esc(m.fromName) + ' to ' + esc(m.toName) + '</span></div>').join("") +
    '<div class="actions" style="flex-direction:column"><button class="btn" data-rb="apply">Apply ' + o.moves.length + (o.moves.length === 1 ? ' move' : ' moves') + '</button><button class="btn ghost" data-rb="dismiss">Leave the tables as they are</button></div></div>' +
    '<div class="note"><b>When you apply</b><br>The handover chain, presentation order, mentor routes, judges’ skipped tables and the badge export all update. Packs already generated are marked as changed.</div></div></div>';
  box.innerHTML = h;
}

// ---------- Check-in ----------
let ciData = null;

// ---------- late additions, seated by hand (Tables page and the desk) ----------
let lateData = null, lateBox = null;
async function loadLate(sel) {
  lateBox = sel || lateBox;
  const box = $(lateBox); if (!box) return;
  const d = lateData = await call("late");
  if (!d.locked || !d.people.length) { box.innerHTML = ""; return; }
  const waiting = d.people.filter((p) => !p.table), seated = d.people.filter((p) => p.table);
  const opts = (p) => d.tables.map((t) => '<option value="' + t.index + '"' + ((p.table ? p.table.index : p.suggested) === t.index ? " selected" : "") + ">" + esc(t.name) + " (" + t.no + ") · " + t.count + " seated" + (t.index === p.suggested ? " · suggested" : "") + "</option>").join("");
  const row = (p) => '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">' +
    '<span><b>' + esc(p.name) + '</b> <span class="small mono">' + esc(p.ref) + "</span>" + (p.organisation ? '<div class="small">' + esc(p.organisation) + "</div>" : "") +
    '<div class="small">Added ' + esc(when(p.addedAt)) + (p.table ? " · at " + esc(p.table.name) + " (" + p.table.no + ")" + (p.checkedIn ? ", checked in" : "") : "") + "</div></span>" +
    (p.checkedIn ? (ROLE === "admin" ? '<button class="link" data-latestk="' + p.id + '">Sticker</button>' : "") :
      '<span style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><select data-lateat="' + p.id + '" style="font:inherit;border:1px solid var(--rule);border-radius:6px;padding:6px 8px;min-height:36px">' + opts(p) + "</select>" +
      (ROLE === "admin" ? '<label class="small" style="display:flex;gap:4px;align-items:center"><input type="checkbox" data-latemail="' + p.id + '"> Email their table</label>' : "") +
      '<button class="btn' + (p.table ? " ghost" : "") + '" data-lateseat="' + p.id + '">' + (p.table ? "Move" : "Seat") + "</button>" + (p.table && ROLE === "admin" ? '<button class="link" data-latestk="' + p.id + '">Sticker</button>' : "") + "</span>") + "</div>";
  box.innerHTML = '<div class="card" style="margin:0 0 14px;border-color:#EFC22D"><h2 style="margin:0">Late additions · ' + waiting.length + ' waiting for a table</h2>' +
    '<p class="small" style="margin:4px 0 6px">Registered or verified after names were locked ' + esc(when(d.lockedAt)) + '. Nobody seats them automatically. The suggested table has the fewest people and nobody from the same organisation. Write the table and ticket on their blank sticker. A late addition can be moved until they check in.</p>' +
    (waiting.length ? waiting.map(row).join("") : '<p class="small" style="margin:0">Nobody waiting.</p>') +
    (seated.length ? '<details style="margin-top:8px"><summary class="small" style="cursor:pointer">Seated by hand · ' + seated.length + "</summary>" + seated.map(row).join("") + "</details>" : "") + "</div>";
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-lateseat]");
  if (!b) return;
  const id = Number(b.dataset.lateseat), p = lateData.people.find((x) => x.id === id);
  const sel = document.querySelector('[data-lateat="' + id + '"]'), t = lateData.tables.find((x) => x.index === Number(sel.value));
  const mailBox = document.querySelector('[data-latemail="' + id + '"]');
  if (!confirm((p.table ? "Move " : "Seat ") + p.name + " at " + t.name + " (" + t.no + ")?" + (t.count >= 8 ? " That table already has " + t.count + "." : ""))) return;
  b.disabled = true;
  try {
    lateData = await call("seat-late", { id, table: t.index, notify: !!(mailBox && mailBox.checked) });
    msg(p.name + " is at " + t.name + " (" + t.no + "). Write " + t.no + " " + t.name + " and " + p.ref + " on their sticker." + (t.count + 1 >= 9 ? " " + t.name + " now has " + (t.count + 1) + "." : ""), true);
    loadLate(); if (typeof loadCheckin === "function" && document.getElementById("ciBox") && !document.getElementById("ciBox").closest("[hidden]")) loadCheckin().catch(() => {});
  } catch (err) { msg(err.message); b.disabled = false; }
});
async function loadCheckin() {
  const d = ciData = await call("checkin");
  const box = $("#ciBox");
  const sw = ROLE === "admin" ? '<button type="button" class="switch" role="switch" aria-checked="' + d.enabled + '" data-ci="toggle"><i></i><span>Check-in is ' + (d.enabled ? "on" : "off") + '</span></button>' : "";
  let h = '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:flex-end;margin:0 0 14px"><div><h1>Check-in</h1><p class="small" style="margin:4px 0 0">Optional. Use it only if there are hands at the desk. Nothing else depends on it.</p></div>' + sw + '</div>';
  if (!d.enabled) { box.innerHTML = h + '<div class="card"><b>Check-in is switched off</b><p class="small" style="margin:6px 0 0;line-height:1.6">Switch it on if you have people at the badge desk on the day. The desk searches a name or reference and taps Arrived, and the Tables page shows how many have arrived at each table. Tables never change because of it.</p></div>'; return; }
  h += '<div id="lateCi"></div><div class="card" style="margin:0 0 14px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end"><label style="flex:1 1 320px;font-size:12px;font-weight:600">Find someone<input type="search" id="ciFind" placeholder="Name or reference, e.g. QLV26-014" style="margin-top:4px;width:100%;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:10px 12px;min-height:44px"></label>' +
    '</div><div id="ciDash" style="margin:0 0 14px"></div>' +
    '<div class="seg" id="ciFilters" style="margin:0 0 10px;flex-wrap:wrap"></div><div class="card" id="ciList"></div>';
  box.innerHTML = h;
  drawCheckin();
  loadLate("#lateCi").catch(() => {});
}
// Who has checked in: everyone, arrived, not yet, or staff, with the time each arrived.
const CI_FILTERS = { all: ["Everyone", () => true], arrived: ["Arrived", (p) => p.arrived], waiting: ["Not arrived yet", (p) => !p.arrived], participants: ["Participants", (p) => !p.staff], staff: ["Staff", (p) => p.staff] };
function drawCiDash() {
  const P = ciData.people, part = P.filter((p) => !p.staff), staff = P.filter((p) => p.staff);
  const tile = (label, n, of, f) => '<button type="button" data-cif="' + f + '" class="card" aria-pressed="' + (ciFilter === f) + '" style="margin:0;flex:1 1 200px;padding:14px 16px;text-align:left;font:inherit;color:inherit;cursor:pointer;' + (ciFilter === f ? "outline:2px solid #0F2B63;" : "") + '"><div class="small">' + label + '</div><div style="font-size:30px;font-weight:700;line-height:1.1">' + n + ' <span style="font-size:15px;font-weight:600;color:var(--mute)">of ' + of + '</span></div>' +
    '<div style="height:8px;background:var(--line);border-radius:4px;margin-top:8px;overflow:hidden"><i style="display:block;height:100%;width:' + (of ? Math.round(n / of * 100) : 0) + '%;background:#1F7D87"></i></div></button>';
  const bars = ciData.tables.map((t) => '<button type="button" data-cif="t:' + esc(t.name) + '" aria-pressed="' + (ciFilter === "t:" + t.name) + '" style="display:flex;width:100%;align-items:center;gap:10px;font:inherit;font-size:13px;margin:2px 0;padding:4px 6px;border:0;border-radius:6px;cursor:pointer;color:inherit;background:' + (ciFilter === "t:" + t.name ? "#EAF1FB" : "transparent") + '"><b style="width:110px;text-align:left">' + esc(t.name) + '</b>' +
    '<span style="flex:1;height:10px;background:var(--line);border-radius:5px;overflow:hidden"><i style="display:block;height:100%;width:' + (t.of ? Math.round(t.count / t.of * 100) : 0) + '%;background:#0F2B63"></i></span><span style="width:60px;text-align:right">' + t.count + ' of ' + t.of + '</span></button>').join("");
  $("#ciDash").innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 12px">' + tile("Participants arrived", part.filter((p) => p.arrived).length, part.length, "participants") + tile("Staff arrived", staff.filter((p) => p.arrived).length, staff.length, "staff") + tile("Everyone", P.filter((p) => p.arrived).length, P.length, "all") + '</div>' +
    '<div class="card" style="margin:0;padding:12px 16px"><h2 style="margin:0 0 4px">By table <span class="small" style="font-weight:400">tap a table to see who</span></h2>' + bars + '</div>';
}
const ciTime = (iso) => iso ? new Date(Date.parse(iso) + 3600000).toISOString().slice(11, 16) : "";
function drawCheckin() {
  const q = ($("#ciFind") ? $("#ciFind").value : "").trim().toLowerCase();
  const P = ciData.people, staff = P.filter((p) => p.staff);
  drawCiDash();
  const part = P.filter((p) => !p.staff);
  const count = { all: P.length, arrived: P.filter((p) => p.arrived).length, waiting: P.filter((p) => !p.arrived).length, participants: part.filter((p) => p.arrived).length + " of " + part.length, staff: staff.filter((p) => p.arrived).length + " of " + staff.length };
  const tb = ciFilter.startsWith("t:") ? ciFilter.slice(2) : null;
  $("#ciFilters").innerHTML = (tb ? '<button type="button" class="on" aria-pressed="true" data-cif="all">' + esc(tb) + ' (' + P.filter((p) => p.where === tb && p.arrived).length + ' of ' + P.filter((p) => p.where === tb).length + ') ✕</button>' : "") + Object.entries(CI_FILTERS).map(([k, [label]]) => '<button type="button" data-cif="' + k + '"' + (ciFilter === k ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + label + ' (' + count[k] + ')</button>').join("");
  const keep = tb ? (p) => p.where === tb : CI_FILTERS[ciFilter][1];
  let rows = P.filter((p) => keep(p) && (!q || (p.name + " " + p.ref).toLowerCase().includes(q)));
  if (ciFilter === "arrived") rows = rows.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  rows = rows.slice(0, 300);
  $("#ciList").innerHTML = rows.map((p) => '<div class="person"><div><b>' + esc(p.name) + '</b><span class="small">' + esc(p.ref) + ' · ' + esc(p.where) + (p.arrived && p.at ? ' · arrived ' + ciTime(p.at) : '') + '</span></div>' +
    '<button class="arr' + (p.arrived ? " on" : "") + '" data-arr="' + p.id + '" aria-pressed="' + p.arrived + '">' + (p.arrived ? "Arrived ✓" : "Arrived") + '</button></div>').join("") || '<p class="small">Nobody matches that search.</p>';
}

// ---------- Briefings ----------
const ROLE_ORDER = ["marshal", "mentor", "judge"];
async function loadBriefings() {
  const [p, t, tp] = await Promise.all([call("packs"), call("sprint"), call("templates")]);
  bfData = { packs: p, tasks: t };
  tplList = tp.templates;
  $("#bfLock").innerHTML = '<div><b>Briefs open at ' + esc(p.unlockLabel) + '</b><div class="small">Until then every brief link shows a holding page. Tasks are never attached to an email.</div></div><button class="btn ghost" data-goto="settings">Change the time</button>';
  drawRoles(); drawPeople(); drawTasks(); drawTemplates();
}
function roleStatus(r) {
  if (!r.count) return '<span class="st released">Nobody in this role</span>';
  if (r.notGenerated === r.count) return '<span class="st released">Not generated yet</span>';
  const bits = [];
  if (r.sent || r.changed) bits.push("Sent to " + (r.sent + r.changed) + " of " + r.count);
  if (r.ready) bits.push(r.ready + " generated, not sent");
  if (r.changed) bits.push(r.changed + " changed since sent");
  if (r.stale) bits.push(r.stale + " out of date, generate again");
  if (r.notGenerated) bits.push(r.notGenerated + " not generated");
  const cls = r.changed || r.stale ? "queried" : r.sent === r.count ? "confirmed" : "awaiting";
  return '<span class="st ' + cls + '">' + esc(bits.join(" · ")) + '</span>';
}
function drawRoles() {
  $("#bfRoles").innerHTML = bfData.packs.roles.map((r) => {
    const canSend = r.ready + r.changed > 0 && !r.stale;
    const sendLabel = r.changed ? "Resend changed" : r.sent === r.count && r.count ? "All sent" : "Send to all";
    return '<div class="rolerow"><div style="flex:1 1 300px"><b>' + esc(r.label) + ' · ' + r.count + (r.count === 1 ? " person" : " people") + '</b><div class="small">' + esc(r.contents) + '</div><div style="margin-top:6px">' + roleStatus(r) + '</div>' +
      (r.missing.length ? '<div class="miss">Still to fill: ' + esc(r.missing.map((m) => m.replace(/_/g, " ")).join(", ")) + '</div>' : "") + '</div>' +
      '<div class="acts"><button class="btn ghost" data-gen="' + r.role + '"' + (r.count ? "" : " disabled") + '>Generate packs</button>' +
      '<button class="btn ghost" data-showrole="' + r.role + '">People</button>' +
      '<button class="btn" data-send="' + r.role + '" data-only="' + (r.changed ? "changed" : "unsent") + '"' + (canSend ? "" : " disabled") + '>' + sendLabel + '</button></div></div>';
  }).join("");
  $("#bfConfirm").innerHTML = bfConfirm ? '<div class="dialog" role="alertdialog" aria-label="Confirm sending"><b style="font-size:15px">' + esc(bfConfirm.title) + '</b><p class="small" style="margin:6px 0 0;line-height:1.6">' + esc(bfConfirm.text) + '</p>' +
    '<div class="actions"><button class="btn ghost" data-confirm="no">Cancel</button><button class="btn gold" data-confirm="yes">' + esc(bfConfirm.button) + '</button></div></div>' : "";
}
function drawPeople() {
  const r = bfData.packs.roles.find((x) => x.role === bfRole);
  $("#bfPeopleTitle").textContent = r.label + " packs";
  const label = { none: "Not generated", stale: "Out of date", ready: "Ready", sent: "Sent", changed: "Changed since sent" };
  const cls = { none: "released", stale: "queried", ready: "awaiting", sent: "confirmed", changed: "queried" };
  $("#bfPeople").innerHTML = r.people.length ? '<table style="min-width:640px"><thead><tr><th>Name</th><th>Tables</th><th>Starts at</th><th>Pack</th><th>Links</th></tr></thead><tbody>' +
    r.people.map((p) => '<tr style="cursor:default"><td><b>' + esc(p.name) + '</b><div class="small mono">' + esc(p.ref) + '</div></td><td class="small">' + esc(p.tables || "") + '</td><td class="small">' + esc(p.start || "") + '</td>' +
      '<td><span class="st ' + cls[p.state] + '">' + label[p.state] + '</span>' + (p.sentAt ? '<div class="small">' + esc(when(p.sentAt)) + '</div>' : "") + (p.opened ? '<div class="small">Link opened</div>' : "") + '</td>' +
      '<td class="small">' + (p.state !== "none" ? '<button class="link" data-preview="' + p.id + '" data-role="' + r.role + '">Preview</button><br>' : "") +
      (p.briefLink ? '<button class="link" data-copy="' + esc(p.briefLink) + '">Copy brief link</button><br>' : "") +
      (p.scoringLink ? '<button class="link" data-copy="' + esc(p.scoringLink) + '">Copy scoring link</button><br>' : "") +
      (p.state === "sent" || p.state === "changed" || p.state === "ready" ? '<button class="link" data-resend="' + p.id + '" data-role="' + r.role + '">' + (p.sentAt ? "Resend" : "Send") + '</button><br>' : "") +
      (p.briefLink ? '<button class="link" data-reissue="' + p.id + '" data-kind="brief">New brief link</button>' : "") + '</td></tr>').join("") + '</tbody></table>'
    : '<p class="small">Nobody in this role yet.</p>';
}
// The six sprint tasks: edit any field, preview the printed card.
const lines = (v) => String(v || "").split("\n").map((x) => x.trim()).filter(Boolean);
function drawTasks() {
  const t = bfData.tasks;
  $("#bfTasks").innerHTML = t.tasks.map((x) => {
    const tables = t.tables.filter((r) => r.taskId === x.id).map((r) => r.name);
    return '<div class="person"><div><b>' + esc(x.code) + ' · ' + esc(x.title) + '</b><span class="small">' + esc(x.sector) + (tables.length ? " · " + esc(tables.join(", ")) : " · not on a table yet") + '</span></div>' +
      '<div style="display:flex;gap:8px;align-items:center"><a class="link" href="/admin/print/taskcard?id=' + x.id + '" target="_blank" rel="noopener">Preview card</a><button class="link" data-task="' + x.id + '">Edit</button></div></div>';
  }).join("");
}
function editTask(id) {
  const x = bfData.tasks.tasks.find((t) => t.id === id);
  const box = $("#taskEdit");
  box.hidden = false;
  const ta = (n, label, v, hint, rows) => '<label>' + label + (hint ? ' <span class="small" style="font-weight:400">' + hint + '</span>' : "") + '<textarea name="' + n + '" rows="' + (rows || 3) + '">' + esc(v) + '</textarea></label>';
  box.innerHTML = '<form class="form2" id="taskForm" data-id="' + id + '"><h2>' + esc(x.code) + ' · ' + esc(x.title) + '</h2>' +
    '<div class="three"><label>Code<input name="code" maxlength="30" value="' + esc(x.code) + '"></label><label style="grid-column:span 2">Sector<input name="sector" maxlength="120" value="' + esc(x.sector) + '"></label></div>' +
    '<label>Title<input name="title" maxlength="140" value="' + esc(x.title) + '"></label>' +
    ta("situation", "The situation", x.situation.join("\n"), "one paragraph per line", 5) +
    ta("people", "The people", x.people.map((r) => r.join(" | ")).join("\n"), "one row per line: Role | Number | What they do now | Spare capacity", 6) +
    ta("problem", "The problem to solve", x.problem, "", 3) +
    ta("work", "What you have to work with", x.work.map((r) => r[0] + ": " + r[1]).join("\n"), "one per line, Label: text (Budget, Tools now, Decision rights, Timing)", 5) +
    ta("out", "Out of bounds", x.out.join("\n"), "one per line", 3) +
    ta("working", "What working looks like", x.working, "", 2) +
    '<p class="small" style="margin:6px 0">For judges and mentors only, never on the card:</p>' +
    ta("vulnerability", "The single point of failure", x.vulnerability, "judges' and mentors' guides", 2) +
    ta("strong", "Strong plans usually", x.strong.join("\n"), "judges only, one per line", 5) +
    ta("watch", "Watch for", x.watch.join("\n"), "judges only, one per line", 3) +
    '<div class="actions"><button class="btn">Save task</button><a class="btn ghost" style="text-decoration:none" href="/admin/print/taskcard?id=' + id + '" target="_blank" rel="noopener">Preview card</a><button type="button" class="btn ghost" data-taskclose="1">Close</button></div></form>';
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}
function drawTemplates() {
  if (!tplKey) tplKey = tplList[0].key;
  $("#tplPick").innerHTML = tplList.map((t) => '<option value="' + t.key + '"' + (t.key === tplKey ? " selected" : "") + '>' + esc(t.label) + (t.edited ? " (edited)" : "") + '</option>').join("");
  const t = tplList.find((x) => x.key === tplKey);
  $("#tplBody").value = t.body;
  $("#tplNote").textContent = t.edited ? "Edited " + when(t.updatedAt) + " by " + t.updatedBy : "Original wording";
}

// ---------- Staff roles (shown on the Staff tab) ----------
async function loadRoles() {
  const d = await call("roles");
  const box = $("#rolesBox");
  if (!box) return;
  const opts = (sel, list) => list.map((o) => '<option value="' + o.v + '"' + (String(o.v) === String(sel) ? " selected" : "") + '>' + esc(o.l) + '</option>').join("");
  box.innerHTML = '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:flex-end;padding:14px 16px 0"><div><h2>Roles on the day</h2><span class="small">Mentors own a pair of tables; a second mentor on a pair starts on the other table. A mentor who also judges never scores the tables they mentored.</span></div>' +
    '<button class="btn" data-autoassign="1">Assign automatically</button></div>' +
    (d.uncovered.length ? '<div class="miss" style="margin:10px 16px">No mentor yet for: ' + esc(d.uncovered.join("; ")) + '</div>' : "") +
    '<table style="min-width:760px"><thead><tr><th>Name</th><th>Mentor</th><th>Judge</th><th>Tables</th><th>Starts at</th></tr></thead><tbody>' +
    d.people.map((p) => {
      const fac = p.kind === "facilitator";
      return '<tr style="cursor:default"><td><b>' + esc(p.name) + '</b><div class="small mono">' + esc(p.ref) + '</div></td>' +
        (fac ? '<td colspan="4"><span class="small">Facilitator, gives the keynote. Ticket only: no lobby, brief, tables or scoring.</span></td></tr>'
          : '<td><input type="checkbox" data-rolechk="mentor" data-id="' + p.id + '"' + (p.mentor ? " checked" : "") + ' style="width:20px;height:20px"></td><td><input type="checkbox" data-rolechk="judge" data-id="' + p.id + '"' + (p.judge ? " checked" : "") + ' style="width:20px;height:20px"></td>') +
        (fac ? "" : '<td>' + (p.mentor ? '<select data-pair="' + p.id + '"><option value="">Choose a pair</option>' + opts(JSON.stringify(p.tables), d.pairs.map((pr) => ({ v: JSON.stringify(pr.tables), l: pr.label }))) + '</select>' : '<span class="small">' + esc(p.tableNames.join(", ") || "Judges only") + '</span>') + '</td>' +
        '<td>' + (p.mentor && p.tables.length ? '<select data-start="' + p.id + '">' + opts(p.startTable, p.tables.map((t, i) => ({ v: t, l: p.tableNames[i] }))) + '</select>' : "") + '</td></tr>');
    }).join("") + '</tbody></table>';
}

// ---------- Scoring ----------
let scData = null;
async function loadScoring() {
  const d = scData = await call("scoring");
  $("#scStrip").innerHTML = '<b>' + (d.strip.onStage ? "Presentations running · " + esc(d.strip.onStage) + " on stage" : "Stage: " + esc(d.strip.phase)) + '</b><span>' + d.strip.complete + ' of ' + d.strip.teams + ' teams fully scored</span><span>' + d.strip.opened + ' of ' + d.strip.judges + ' judges have opened their link</span>';
  const label = { advised: "Advised", waiting: "Waiting", none: "Not yet", unlocked: "Unlocked" };
  $("#scTally").innerHTML = '<table style="min-width:' + (360 + d.judges.length * 80) + 'px"><thead><tr><th>Slot</th><th>Table</th>' + d.judges.map((j) => '<th title="' + esc(j.name) + '">' + j.code + '</th>').join("") + '<th>Average</th><th>' + esc(d.outlivesName) + '</th></tr></thead><tbody>' +
    d.rows.map((r) => '<tr style="cursor:default' + (r.onStage ? ';background:#FFF8E2' : '') + '"><td class="small">' + esc(r.time) + '</td><td><b>' + esc(r.name) + '</b></td>' +
      r.cells.map((c) => '<td style="padding:6px 4px">' + (c.kind === "score" ? '<button class="cell score" data-unlock="' + c.judge + '" data-table="' + r.index + '" title="' + esc(c.values.join(", ") + (c.unlocked ? " · unlocked before by " + c.unlocked.by + ": " + c.unlocked.reason : "") + ". Click to unlock") + '">' + c.total + '</button>' : '<span class="cell ' + c.kind + '">' + label[c.kind] + '</span>') + '</td>').join("") +
      '<td><b>' + (r.complete || r.scored ? esc(r.avgText) : "") + '</b>' + (!r.complete && r.scored ? '<div class="small">' + r.scored + ' of ' + r.expected + '</div>' : "") + '</td><td>' + esc(r.outlivesText) + '</td></tr>').join("") + '</tbody></table>';
  $("#scOrder").innerHTML = d.order.map((r, i) => '<div class="q"><b>' + (i + 1) + '. ' + esc(r.name) + (r.tied ? ' <span class="no2">Tied: judges decide</span>' : "") + '</b><span>' + esc(r.avgText) + '</span></div>').join("") || '<p class="small">No team is fully scored yet.</p>';
  $("#scJudges").innerHTML = d.judges.map((j) => '<div class="q" style="flex-wrap:wrap;gap:4px"><span><b>' + j.code + '</b> ' + esc(j.name) + '</span><span class="small">' + (j.advisedNames.length ? "Advised " + esc(j.advisedNames.join(", ")) : "Scores every table") + '</span>' +
    '<span style="width:100%"><button class="link" data-copy="' + esc(j.link) + '">Copy scoring link</button> · <button class="link" data-reissue="' + j.id + '" data-kind="scoring">New link</button></span></div>').join("") || '<p class="small">Nobody is set as a judge yet. Tick Judge on the Staff tab.</p>';
}

// ---------- Stage ----------
async function loadStage() {
  const d = stData = await call("stage");
  $("#stResetCard").hidden = ROLE !== "admin";
  stOffset = d.serverNow - Date.now();
  $("#stDisp").innerHTML = d.display.connected ? '<span class="ok2">Display connected · sound ' + (d.display.sound ? "on" : "off") + '</span>' : '<span class="no2">Display not connected</span>';
  $("#stPhases").innerHTML = d.phases.map((p) => '<button class="' + (p.on ? "on" : p.done ? "done" : "") + '" data-phase="' + p.id + '" aria-pressed="' + p.on + '">' + esc(p.label) + (p.done ? " ✓" : "") + '</button>').join("");
  const st = d.state;
  $("#stQueue").innerHTML = d.queue.map((q) => '<div class="q"><span><span class="small" style="margin-right:10px">' + esc(q.time) + '</span><b>' + esc(q.name) + '</b></span><span class="' + (q.state === "On stage" ? "st awaiting" : q.state ? "st released" : "") + '">' + esc(q.state) + '</span></div>').join("");
  const t = st.toggles;
  $("#stToggles").innerHTML = [["partners", "Thank our sponsors"], ["schedule", "Show the day’s schedule"], ["animation", "Play the opening animation"], ["music", "Soft music during arrival (needs sound on at the display)"]].map(([k, l]) =>
    '<label style="display:flex;align-items:center;gap:10px;min-height:44px;font-size:13px"><input type="checkbox" data-toggle="' + k + '"' + ((k === "music" ? t[k] !== false : t[k]) ? " checked" : "") + ' style="width:20px;height:20px">' + l + '</label>').join("");
  $("#stSpeakers").innerHTML = d.speakers.map((x) => '<button class="btn' + (st.speaker === x.id ? " gold" : " ghost") + '" data-speaker="' + x.id + '" style="width:100%;margin:0 0 8px;text-align:left">' + esc(x.label) + (x.logo ? "" : " (no logo yet)") + (st.speaker === x.id ? " · on screen" : "") + "</button>").join("") +
    (st.speaker ? '<button class="btn ghost" data-speaker="" style="width:100%">Take the speaker off the display</button>' : "");
  $("#stJudgesCard").hidden = ROLE !== "admin" && !d.judgesPhoto;
  $("#stJudges").innerHTML = (d.judgesPhoto ? '<img alt="The judges" src="' + esc(d.judgesPhoto) + '" style="width:100%;border-radius:8px;margin:0 0 8px">' : '<p class="small" style="margin:0 0 8px"><b>No photo yet.</b> The slide appears once you upload one.</p>') +
    (ROLE === "admin" ? '<div class="actions"><button class="btn ghost" data-judgesup="1">' + (d.judgesPhoto ? "Replace photo" : "Upload photo") + "</button>" + (d.judgesPhoto ? '<button class="link" data-judgesrm="1">Remove</button>' : "") + "</div>" : "");
  // Two presses: "And the winner is…", then the winner. Only the winner is shown.
  const step = st.revealed ? (st.revealStep || 2) : 0;
  $("#stReveal").innerHTML = !st.revealed
    ? '<button class="btn gold" data-st="reveal" style="width:100%"' + (d.scored.all ? "" : " disabled") + '>Start the winner reveal · ' + d.scored.complete + ' of ' + d.scored.teams + ' teams scored</button><p class="small" style="margin:8px 0 0">The display shows "And the winner is…". Press again to show the winning team. Only the winner is shown, with no scores.</p>'
    : (step < 2
      ? '<p class="ok2" style="display:inline-block">"And the winner is…" showing</p><button class="btn gold" data-st="reveal" style="width:100%;margin-top:8px">Reveal the winner</button>'
      : '<p class="ok2" style="display:inline-block">The winner is showing on the display</p>') +
      '<div class="actions"><button class="btn ghost" data-st="hideResults">Hide results again</button></div>';
  drawClock();
  clearInterval(stTimer);
  stTimer = setInterval(() => { if ($("#stageView").hidden) return clearInterval(stTimer); drawClock(); }, 250);
}
if ($("#stJudgesFile")) $("#stJudgesFile").addEventListener("change", async (e) => {
  let file = e.target.files[0]; if (!file) return;
  try {
    // Any photo the browser can open goes up as a JPG at most 2400 pixels wide.
    let img;
    try { img = await createImageBitmap(file); } catch { throw new Error("That file is not a photo this browser can open. Use a JPG or PNG."); }
    const k = Math.min(1, 2400 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    file = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.88));
    const res = await fetch("/admin/judges-photo", { method: "POST", credentials: "same-origin", headers: { "x-admin": "1", "content-type": file.type || "application/octet-stream" }, body: file });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "The photo did not upload.");
    msg("Photo uploaded. It joins the arrival rotation.", true); loadStage();
  } catch (err) { msg(err.message); }
});
function stRemaining() {
  const c = stData.state.clock;
  if (c.pausedMs !== null && c.pausedMs !== undefined) return c.pausedMs;
  if (!c.endsAt) return null;
  return Math.max(0, c.endsAt - (Date.now() + stOffset));
}
function drawClock() {
  const d = stData, st = d.state, rem = stRemaining(), paused = st.clock.pausedMs !== null && st.clock.pausedMs !== undefined;
  const lab = { arrival: "Arrival", sprint: "Planning round", handover: "Handover", critique: "Critique", response: "Response", lunch: "Lunch", presentations: "Presentations" + (d.queue.find((q) => q.state === "On stage") ? " · " + d.queue.find((q) => q.state === "On stage").name + " on stage" : ""), results: "Panel feedback and recognitions" }[st.phase];
  const cue = { sprint: "Chime at halfway and at five minutes, gong at zero", handover: "Plans moving round the chain", critique: "Gap, question, strength", response: "Each team answers its critique", presentations: "Amber at 1:00, gong at zero", arrival: "Schedule and sponsor thanks on the display", lunch: "Judges are reading", results: st.revealed ? ((st.revealStep || 2) >= 2 ? "The winner on the display" : "And the winner is…") : "Waiting for every score" }[st.phase];
  const timed = rem !== null;
  $("#stClock").innerHTML = '<div><div class="l">' + esc(lab) + (paused ? " · paused" : "") + '</div><div class="t"' + (timed ? "" : ' style="font-size:28px;padding:14px 0"') + '>' + (timed ? mmss(rem) : "No clock running") + '</div><div class="c">' + esc(cue) + '</div></div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px">' + (timed ? '<button class="btn ghost" data-st="' + (paused ? "resume" : "pause") + '">' + (paused ? "Resume" : "Pause") + '</button><button class="btn ghost" data-st="addMinute">Add 1 minute</button>' : "") +
    (d.nextLabel ? '<button class="btn gold" data-st="next">' + esc(d.nextLabel) + '</button>' : "") + '</div>';
}

// ---------- Settings ----------
let setData = null;
async function loadBoard() {
  const b = await call("board-access");
  $("#setBoard").innerHTML = (b.on
    ? '<div class="okbox" style="margin:0 0 10px">On. Passcode: <b class="mono" style="font-size:15px;user-select:all">' + esc(b.code) + '</b></div>' +
      '<p class="small" style="margin:0 0 10px">Board members open the admin page, go to Board view and type this. They stay signed in for up to 7 days.</p>' +
      '<div class="actions"><button class="btn ghost" data-board="new">New passcode</button><button class="btn warn" data-board="off">Turn off</button></div>'
    : '<p class="small" style="margin:0 0 10px">Off. Nobody can open the board view.</p><div class="actions"><button class="btn" data-board="on">Turn on and make a passcode</button></div>') +
    (b.visits.length ? '<div class="small" style="margin-top:10px"><b>Recent board sign-ins</b>' + b.visits.map((v) => "<div>" + esc(when(v.at)) + ", " + esc(v.device) + "</div>").join("") + "</div>" : "");
}
async function loadSettings() {
  loadBoard().catch((err) => msg(err.message));
  const d = setData = await call("settings");
  const s = d.settings;
  const f = (name, label, value, type, extra) => '<label>' + label + '<input name="' + name + '" type="' + (type || "text") + '" value="' + esc(value) + '"' + (extra || "") + '></label>';
  $("#setForm").innerHTML = '<h2>Teams and briefs</h2>' +
    '<div class="two">' + f("min_table_size", "Smallest table allowed", s.min_table_size, "number", ' min="2" max="8"') + f("teams_announced_at", "Teams announced at", abuja(s.teams_announced_at), "datetime-local") + '</div>' +
    '<div class="two">' + f("brief_unlock_at", "Briefs open at", abuja(s.brief_unlock_at), "datetime-local") + f("event_day", "Judges’ links work on", s.event_day, "date") + '</div>' +
    '<h2 style="margin-top:8px">Arrival times</h2><div class="three">' + f("arr_marshal", "Lead Sprint Marshal", s.arrival_time.marshal || s.arrival_time.facilitator) + f("arr_mentor", "Mentors/Advisors", s.arrival_time.mentor) + f("arr_judge", "Judges", s.arrival_time.judge) + '</div>' +
    '<h2 style="margin-top:8px">People</h2><div class="two"><label>Judges’ spokesperson<select name="spokesperson"><option value="">Not chosen yet</option>' + d.judges.map((j) => '<option value="' + j.id + '"' + (j.id === s.spokesperson ? " selected" : "") + '>' + esc(j.name) + '</option>').join("") + '</select></label>' +
    f("chair_name", "Chairperson’s name", s.chair_name) + '</div>' + f("chair_phone", "Chairperson’s phone, used in the briefs", s.chair_phone) +
    '<h2 style="margin-top:8px">The clock</h2><div class="three">' + f("sprint_start", "Sprint opens", s.sprint_start) + f("sprint_minutes", "Sprint minutes", s.sprint_minutes, "number") + f("critique_minutes", "Critique minutes", s.critique_minutes, "number") + '</div>' +
    '<div class="three">' + f("response_minutes", "Response minutes", s.response_minutes, "number") + f("presentations_start", "Presentations start", s.presentations_start) + f("presentation_minutes", "Minutes per presentation", s.presentation_minutes, "number") + '</div>' +
    '<div class="three">' + f("changeover_minutes", "Changeover minutes", s.changeover_minutes, "number") + '</div>' +
    '<label>The day’s schedule on the display, one line each: time, then what happens<textarea name="schedule" rows="9">' + esc(s.schedule.map((x) => x.t + " " + x.what).join("\n")) + '</textarea></label>' +
    '<label style="display:flex;align-items:center;gap:10px"><input type="checkbox" name="checkin_enabled"' + (s.checkin_enabled ? " checked" : "") + ' style="width:20px;height:20px;min-height:0;margin:0">Check-in desk is on</label>' +
    '<div class="actions"><button class="btn">Save settings</button></div>';
  $("#setTeams").innerHTML = d.frozen ? '<p class="ok2" style="display:inline-block">Teams have been announced</p><p class="small">Nobody already seated can be moved. Late additions are flagged on the Tables page.</p>'
    : '<p class="small" style="margin:0 0 10px">Tables freeze automatically at ' + esc(when(s.teams_announced_at)) + '. If you announce earlier, press this as you do.</p><button class="btn warn" data-announce="1" style="width:100%">Teams have been announced</button>';
  $("#setAccess").innerHTML = d.access.map((a) => '<div class="q"><span>' + esc(a.email) + '<div class="small">' + (a.role === "desk" ? "Check-in desk" : "Stage coordinator") + '</div></span><button class="link" data-accrm="' + esc(a.email) + '">Remove</button></div>').join("") || '<p class="small">Nobody else yet.</p>';
}

// ---------- events ----------
document.addEventListener("click", async (e) => {
  const el = (s) => e.target.closest(s);
  try {
    if (el("[data-min]")) { await call("settings", { settings: { min_table_size: rbData.min + Number(el("[data-min]").dataset.min) } }); return loadRebalance(); }
    if (el("[data-rbopt]")) { rbOpt = el("[data-rbopt]").dataset.rbopt; return loadRebalance(); }
    if (el("[data-rb]")) {
      const a = el("[data-rb]").dataset.rb;
      if (a === "dismiss") { await call("rebalance-dismiss", {}); msg("The flag is dismissed. It comes back if the tables change.", true); return loadRebalance(); }
      const o = rbData.options[rbOpt];
      if (!confirm("Apply " + o.moves.length + " moves now? Everyone moves in one step.")) return;
      const expect = o.moves.map((m) => m.id + ">" + m.to + ":" + m.seat).join(",");
      const r = await call("rebalance", { option: rbOpt, table: rbData.target.index, expect });
      msg(r.applied + " moves applied. Mentor routes were reassigned; generate the packs again.", true); return loadRebalance();
    }
    if (el("[data-ci=toggle]")) { await call("settings", { settings: { checkin_enabled: !ciData.enabled } }); return loadCheckin(); }
    if (el("[data-arr]")) { const b = el("[data-arr]"); const p = ciData.people.find((x) => x.id === Number(b.dataset.arr)); ciData = await call("checkin", { id: p.id, arrived: !p.arrived }); return drawCheckin(); }
    if (el("[data-cif]")) { ciFilter = el("[data-cif]").dataset.cif; drawCheckin(); if (el("#ciDash")) $("#ciFilters").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (el("[data-gen]")) { const b = el("[data-gen]"); b.disabled = true; bfData.packs = await call("packs-generate", { role: b.dataset.gen }); bfRole = b.dataset.gen; msg("Packs generated. Preview one before sending.", true); drawRoles(); return drawPeople(); }
    if (el("[data-showrole]")) { bfRole = el("[data-showrole]").dataset.showrole; return drawPeople(); }
    if (el("[data-send]")) {
      const b = el("[data-send]"), r = bfData.packs.roles.find((x) => x.role === b.dataset.send);
      const n = b.dataset.only === "changed" ? r.changed : r.ready;
      bfConfirm = { role: r.role, only: b.dataset.only, title: "Send " + n + (n === 1 ? " pack" : " packs") + " to " + r.label + "?", text: "Each person gets an email with their own brief link. The link opens at " + bfData.packs.unlockLabel + ". The email itself contains no task.", button: "Send " + n + (n === 1 ? " pack" : " packs") };
      return drawRoles();
    }
    if (el("[data-confirm]")) {
      const go = el("[data-confirm]").dataset.confirm === "yes", c = bfConfirm; bfConfirm = null;
      if (go) { const r = await call("packs-send", { role: c.role, only: c.only }); bfData.packs = r; msg(r.sent + (r.sent === 1 ? " pack sent." : " packs sent."), true); drawPeople(); }
      return drawRoles();
    }
    if (el("[data-resend]")) {
      const b = el("[data-resend]");
      if (!confirm("Send this pack's email now?")) return;
      bfData.packs = await call("packs-send", { role: b.dataset.role, id: Number(b.dataset.resend) }); msg("Sent.", true); drawRoles(); return drawPeople();
    }
    if (el("[data-preview]")) { const b = el("[data-preview]"); const w = window.open("", "_blank"); const r = await call("pack-preview", { id: Number(b.dataset.preview), role: b.dataset.role }); w.location = r.url; return; }
    if (el("[data-reissue]")) {
      const b = el("[data-reissue]");
      if (!confirm("Make a new link? The old one stops working at once. Generate and send the pack again so they have the new one.")) return;
      await call("reissue", { id: Number(b.dataset.reissue), kind: b.dataset.kind }); msg("New link made. The old one no longer works.", true);
      return $("#scoringView").hidden ? loadBriefings() : loadScoring();
    }
    if (el("[data-copy]")) { await navigator.clipboard.writeText(el("[data-copy]").dataset.copy); el("[data-copy]").textContent = "Copied"; return; }
    if (el("[data-task]")) return editTask(el("[data-task]").dataset.task);
    if (el("[data-taskclose]")) { $("#taskEdit").hidden = true; return; }
    if (el("[data-tpl]")) {
      const a = el("[data-tpl]").dataset.tpl;
      if (a === "reset" && !confirm("Go back to the original wording for this template?")) return;
      const r = await call(a === "save" ? "template" : "template-reset", { key: tplKey, body: $("#tplBody").value });
      tplList = r.templates; drawTemplates(); msg(a === "save" ? "Wording saved. Generate the packs again to use it." : "Original wording restored.", true); return;
    }
    if (el("[data-autoassign]")) { await call("auto-assign", {}); msg("Routes and tables assigned. Generate the packs again.", true); return loadRoles(); }
    if (el("[data-unlock]")) {
      const b = el("[data-unlock]");
      const reason = prompt("Unlock this score so the judge can submit it again. What is the reason? It is kept with the score.");
      if (!reason) return;
      await call("unlock", { judge: Number(b.dataset.unlock), table: Number(b.dataset.table), reason }); msg("Unlocked. The judge can score this table again.", true); return loadScoring();
    }
    if (el("[data-phase]")) {
      const p = el("[data-phase]").dataset.phase;
      if (!confirm("Move the display to " + el("[data-phase]").textContent.replace(" ✓", "") + "? A timed stage starts its clock from the beginning.")) return;
      stData = await call("stage", { action: "phase", phase: p }); return loadStage();
    }
    if (el("[data-speaker]")) {
      const v = el("[data-speaker]").dataset.speaker || null;
      stData = await call("stage", { action: "speaker", speaker: v }); return loadStage();
    }
    if (el("[data-judgesup]")) { $("#stJudgesFile").value = ""; $("#stJudgesFile").click(); return; }
    if (el("[data-judgesrm]")) {
      if (!confirm("Take the judges' photo off the display?")) return;
      await call("judges-photo-remove", {}); return loadStage();
    }
    if (el("[data-streset]")) {
      if (!confirm("Reset the stage? It goes back to Arrival, every team is marked as not yet presented and the results are hidden.")) return;
      stData = await call("stage-reset", {}); msg("The stage is reset.", true); return loadStage();
    }
    if (el("[data-st]")) {
      const a = el("[data-st]").dataset.st;
      if (a === "open") { const w = window.open("", "_blank"); const r = await call("display-link"); w.location = r.url; return; }
      if (a === "reveal" && !stData.state.revealed && !confirm("Start the winner reveal? The display shows \"And the winner is…\". Press again to show the winning team.")) return;
      // The gold button acts on one press. Ask only when it would cut a clock short.
      if (a === "next") {
        const rem = stRemaining();
        if (rem !== null && rem > 0) {
          const on = (stData.queue.find((q) => q.state === "On stage") || {}).name;
          const ask = stData.state.phase === "presentations" && on ? "End " + on + "'s presentation with " + mmss(rem) + " still on the clock?" : stData.nextLabel + "? " + mmss(rem) + " is still on the clock.";
          if (!confirm(ask)) return;
        }
      }
      await call("stage", { action: a }); if (a === "testSound") msg("Test sound sent. It plays on the display if sound is on there.", true); return loadStage();
    }
    if (el("[data-announce]")) {
      if (!confirm("Mark the teams as announced? From now on nobody already seated can be moved. This cannot be undone.")) return;
      await call("teams-announced", {}); msg("Teams are frozen.", true); return loadSettings();
    }
    if (el("[data-board]")) {
      const a = el("[data-board]").dataset.board;
      if (a === "new" && !confirm("Make a new passcode? Everyone using the old one is signed out and needs the new one.")) return;
      if (a === "off" && !confirm("Turn the board view off? Everyone using it is signed out.")) return;
      await call("board-access", { action: a }); msg(a === "off" ? "Board view turned off." : "Board passcode ready. Copy it from the Board view card.", true); return loadBoard();
    }
    if (el("[data-accrm]")) { await call("access", { email: el("[data-accrm]").dataset.accrm, remove: true }); return loadSettings(); }
  } catch (err) { msg(err.message); }
});
document.addEventListener("change", async (e) => {
  const t = e.target;
  try {
    if (t.id === "tplPick") { tplKey = t.value; return drawTemplates(); }
    if (t.matches("[data-toggle]")) { await call("stage", { action: "toggles", toggles: { [t.dataset.toggle]: t.checked } }); return; }
    if (t.matches("[data-rolechk]")) { await call("role", { id: Number(t.dataset.id), [t.dataset.rolechk]: t.checked }); return loadRoles(); }
    if (t.matches("[data-pair]")) { await call("role", { id: Number(t.dataset.pair), tables: t.value ? JSON.parse(t.value) : [] }); return loadRoles(); }
    if (t.matches("[data-start]")) { await call("role", { id: Number(t.dataset.start), startTable: Number(t.value) }); return loadRoles(); }
  } catch (err) { msg(err.message); }
});
document.addEventListener("input", (e) => { if (e.target.id === "ciFind") drawCheckin(); });
document.addEventListener("submit", async (e) => {
  const f = e.target;
  try {
    if (f.id === "taskForm") {
      e.preventDefault();
      const v = (n) => f.elements[n].value;
      await call("sprint-task", {
        id: f.dataset.id, code: v("code"), title: v("title"), sector: v("sector"), problem: v("problem"), working: v("working"), vulnerability: v("vulnerability"),
        situation: lines(v("situation")), out: lines(v("out")), strong: lines(v("strong")), watch: lines(v("watch")),
        people: lines(v("people")).map((l) => l.split("|").map((x) => x.trim())),
        work: lines(v("work")).map((l) => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; }),
      });
      bfData.tasks = await call("sprint");
      msg("Task saved. Packs that include it are marked as changed.", true); drawTasks(); $("#taskEdit").hidden = true; return;
    }
    if (f.id === "setForm") {
      e.preventDefault();
      const v = (n) => f.elements[n].value;
      const schedule = v("schedule").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\d{1,2}:\d{2})\s+(.+)$/); return m ? { t: m[1], what: m[2] } : { t: "", what: l }; });
      await call("settings", { settings: {
        min_table_size: v("min_table_size"), teams_announced_at: v("teams_announced_at"), brief_unlock_at: v("brief_unlock_at"), event_day: v("event_day"),
        arrival_time: { marshal: v("arr_marshal"), mentor: v("arr_mentor"), judge: v("arr_judge") },
        spokesperson: v("spokesperson") || null, chair_name: v("chair_name"), chair_phone: v("chair_phone"),
        sprint_start: v("sprint_start"), sprint_minutes: v("sprint_minutes"), critique_minutes: v("critique_minutes"), response_minutes: v("response_minutes"),
        presentations_start: v("presentations_start"), presentation_minutes: v("presentation_minutes"), changeover_minutes: v("changeover_minutes"),
        schedule, checkin_enabled: f.elements.checkin_enabled.checked,
      } });
      msg("Settings saved.", true); return loadSettings();
    }
    if (f.id === "accForm") { e.preventDefault(); await call("access", { email: f.elements.email.value, role: f.elements.role.value }); f.reset(); msg("Sign-in added. They ask for a link on the admin page with that email.", true); return loadSettings(); }
  } catch (err) { msg(err.message); }
});
`;

// The page for desk volunteers and stage operators: one view, nothing else.
export const ONE_VIEW_JS = String.raw`
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const when = (s) => s ? new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : "";
async function call(path, body) {
  const opts = body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json", "x-admin": "1" }, body: JSON.stringify(body) };
  const res = await fetch("/admin/api/" + path, { credentials: "same-origin", ...opts });
  if (res.status === 401) { location.href = "/admin"; throw new Error("Signed out"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function msg(text, ok) { const m = $("#msg"); m.className = "msg " + (ok ? "ok" : "err"); m.textContent = text; m.hidden = !text; }
`;
