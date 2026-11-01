// The Team rooms tab: opening the lobby and the rooms, the scheduled posts,
// who has their link, each table's activity and the latest messages with
// Hide and Restore. Admin only. Uses the helpers in the main admin script
// ($, esc, call, msg, when) and abuja() from the part 2 script.

export const LOBBY_STYLE = String.raw`
#lobbyView .lstate{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
#lobbyView .pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;border-radius:4px;padding:3px 7px}
#lobbyView .pill.on{background:#E2F2F2;color:#19646D}#lobbyView .pill.off{background:#EEF1F5;color:var(--mute)}#lobbyView .pill.warn{background:#FFF4D6;color:#7A5A00}
#lobbyView .lp-body{white-space:pre-line;font-size:12px;line-height:1.55}#lobbyView .lp-body b{color:var(--navy)}
#lobbyView .lp-form textarea{width:100%;min-height:90px;font:inherit;border:1px solid var(--rule);border-radius:7px;padding:9px 11px}
#lobbyView .lp-form input,#lobbyView .lp-form select{font:inherit;border:1px solid var(--rule);border-radius:7px;padding:8px 10px;min-height:40px}
#lobbyView .lmsg{border-bottom:1px solid var(--line);padding:9px 0;font-size:12px}#lobbyView .lmsg.hid{opacity:.5}
#lobbyView .lmsg b{color:var(--navy)}#lobbyView .tiny{font-size:11px;color:var(--mute)}
`;

export const LOBBY_HTML = String.raw`
<div id="lobbyView" hidden>
  <div style="margin:0 0 12px"><h1>Lobby and team rooms</h1><p class="small" style="margin:4px 0 0">One personal link per person: the lobby until teams are announced, then their team room. Times are Abuja time.</p></div>
  <div class="card" id="lbState" style="margin:0 0 14px"></div>
  <div class="grid">
    <div class="list" style="flex:3 1 600px">
      <div class="card" style="margin:0 0 14px"><h2>Scheduled posts</h2><p class="small" style="margin:-4px 0 10px">The first line is what shows in the notification. Posts go out on their own at the set time once the lobby is open.</p><div id="lbPosts"></div></div>
      <div class="card" style="padding:0;overflow-x:auto;margin:0 0 14px"><div style="padding:14px 16px 0"><h2>People</h2></div>
        <table><thead><tr><th>Name</th><th>Role and table</th><th>Link</th><th>Last opened</th><th>App</th><th>Alerts</th><th></th></tr></thead><tbody id="lbPeople"></tbody></table></div>
      <div class="card" style="margin:0 0 14px"><h2>Latest messages</h2><div id="lbMsgs"></div></div>
    </div>
    <div class="side" style="flex:1 1 340px">
      <form class="card lp-form" id="lbPostForm" style="margin:0 0 14px"><h2 id="lbPostHead">Add a post</h2>
        <input type="hidden" name="postId">
        <label class="fl">Goes out at (Abuja time)<input type="datetime-local" name="sendAt" min="2026-10-31T00:00" max="2026-11-08T23:59" required></label>
        <label class="fl">Where<select name="audience"><option value="lobby">Lobby</option><option value="rooms">All team rooms</option></select></label>
        <label class="fl">Post<textarea name="body" maxlength="600" required placeholder="First line: the headline people see in the notification.&#10;Then the rest of the post."></textarea></label>
        <p class="small" style="margin:-6px 0 10px">Use {meet_link} or {explainer_link} and the link set below is filled in.</p>
        <div class="actions"><button class="btn">Save post</button><button type="button" class="btn ghost" id="lbPostCancel" hidden>Cancel editing</button></div></form>
      <form class="card lp-form" id="lbLinks" style="margin:0 0 14px"><h2>Links and closing</h2>
        <label class="fl">Google Meet link for Friday<input type="url" name="meet_link" placeholder="https://meet.google.com/…"></label>
        <label class="fl">Explainer video link<input type="url" name="explainer_link" placeholder="https://…"></label>
        <label class="fl">Lobby and rooms close (Abuja time)<input type="datetime-local" name="close_at" min="2026-11-01T00:00" max="2026-11-30T23:59"></label>
        <button class="btn" style="width:100%">Save</button></form>
      <form class="card lp-form" id="lbTeam" style="margin:0 0 14px"><h2>QLV team</h2>
        <p class="small" style="margin:-4px 0 10px">Organisers who should see the lobby and every team room as participants do. They get their own link, can post, show as "QLV team", and have no ticket, badge or table.</p>
        <div id="lbTeamList"></div>
        <label class="fl">Full name<input type="text" name="name" maxlength="120" required></label>
        <label class="fl">Email<input type="email" name="email" maxlength="160" required></label>
        <button class="btn" style="width:100%">Add to the QLV team</button></form>
      <div class="card" style="margin:0 0 14px"><h2>By table</h2><div id="lbTables"></div></div>
      <div class="card" id="lbLate" hidden><h2>Added after the freeze, no room</h2><div id="lbLateList"></div></div>
    </div>
  </div>
</div>`;

export const LOBBY_JS = String.raw`
let lbData = null;
const LB_ROLE = { participant: "Participant", mentor: "Mentor", marshal: "Lead Sprint Marshal", facilitator: "Facilitator", team: "QLV team" };
const lbBody = (s) => { const [t, ...r] = String(s).split("\n"); return "<b>" + esc(t) + "</b>" + (r.length ? "\n" + esc(r.join("\n")) : ""); };
async function loadLobby(d) {
  const x = lbData = d || await call("lobby");
  const st = x.state;
  const rooms = st.rooms_open ? '<span class="pill on">Open</span> since ' + esc(when(st.rooms_opened_at))
    : st.frozen ? '<span class="pill warn">Ready to open</span>' : '<span class="pill off">Closed</span> until teams are announced (' + esc(when(st.teamsAnnouncedAt)) + ")";
  $("#lbState").innerHTML = '<div class="lstate"><div>' +
    "<div><b>Lobby</b> " + (st.shut ? '<span class="pill off">Closed</span>' : st.open ? '<span class="pill on">Open</span> since ' + esc(when(st.opened_at)) : '<span class="pill off">Not open yet</span>') + "</div>" +
    '<div style="margin-top:6px"><b>Team rooms</b> ' + rooms + "</div>" +
    '<div class="small" style="margin-top:6px">Closes ' + esc(when(st.close_at)) + (x.welcomeWaiting && st.open ? ". " + x.welcomeWaiting + " lobby email" + (x.welcomeWaiting === 1 ? "" : "s") + " still to go out; they follow automatically as the daily email allowance frees up." : "") + "</div></div>" +
    '<div class="actions" style="margin:0"><a class="btn ghost" style="text-decoration:none" target="_blank" rel="noopener" href="' + esc(SITE) + 'my/?demo=1">See the demo</a>' +
    (!st.open ? '<button class="btn gold" data-lb="open">Open the lobby</button>' : "") +
    (st.open && !st.rooms_open && !st.shut ? '<button class="btn' + (st.frozen ? " gold" : " ghost") + '" data-lb="rooms"' + (st.frozen ? "" : " disabled title=\"Available once teams are announced\"") + ">Open team rooms</button>" : "") +
    (st.open && !st.shut ? '<button class="btn warn" data-lb="close">Close lobby and rooms</button>' : "") +
    (st.open && st.closed ? '<button class="btn ghost" data-lb="reopen">Reopen</button>' : "") + "</div></div>";
  const lf = $("#lbLinks");
  if (document.activeElement?.form !== lf) { lf.meet_link.value = st.meet_link || ""; lf.explainer_link.value = st.explainer_link || ""; lf.close_at.value = abuja(st.close_at); }
  $("#lbPosts").innerHTML = '<table><thead><tr><th>When</th><th>Where</th><th>Post</th><th>Status</th><th></th></tr></thead><tbody>' + x.posts.map((p) =>
    "<tr><td style=\"white-space:nowrap\">" + esc(when(p.sendAt)) + "</td><td>" + (p.audience === "rooms" ? "All rooms" : "Lobby") + '</td><td class="lp-body">' + lbBody(p.body) +
    (p.waitingFor.length ? '<div class="flag" style="margin-top:4px">Waiting: set the ' + p.waitingFor.map((k) => k === "meet_link" ? "Meet link" : "explainer link").join(" and ") + " below</div>" : "") + "</td><td>" +
    (p.status === "sent" ? '<span class="pill on">Sent</span><div class="tiny">' + esc(when(p.sentAt)) + (p.openedAfter !== null ? "<br>" + p.openedAfter + " opened the app since" : "") + "</div>" : p.status === "cancelled" ? '<span class="pill off">Cancelled</span>' : '<span class="pill warn">Scheduled</span>') +
    '</td><td style="white-space:nowrap">' + (p.status === "sent" ? "" : p.status === "cancelled" ? '<button class="link" data-lbp="restore" data-id="' + p.id + '">Restore</button>'
      : '<button class="link" data-lbedit="' + p.id + '">Edit</button> · <button class="link" data-lbp="send" data-id="' + p.id + '">Send now</button> · <button class="link" data-lbp="cancel" data-id="' + p.id + '">Cancel</button>') + "</td></tr>").join("") + "</tbody></table>";
  $("#lbPeople").innerHTML = x.people.map((p) => "<tr><td><b>" + esc(p.name) + '</b><div class="tiny mono">' + esc(p.ref) + "</div></td><td>" + LB_ROLE[p.role] + (p.table ? '<div class="tiny">' + esc(p.table) + "</div>" : "") + "</td><td>" +
    (p.told ? (p.toldBy === "ticket" ? "In ticket email" : "Emailed") + '<div class="tiny">' + esc(when(p.told)) + "</div>" : st.open ? '<span class="tiny">Email waiting</span>' : '<span class="tiny">When the lobby opens</span>') + "</td><td>" + (p.lastOpened ? esc(when(p.lastOpened)) : '<span class="tiny">Not yet</span>') +
    "</td><td>" + (p.installed ? "Yes" : '<span class="tiny">No</span>') + "</td><td>" + (p.push === "on" ? "On" : p.push === "denied" ? '<span class="tiny">Blocked</span>' : '<span class="tiny">Off</span>') + '</td><td style="white-space:nowrap">' +
    (st.open ? (p.link ? '<button class="link" data-lbcopy="' + esc(p.link) + '">Copy link</button> · ' : "") + '<button class="link" data-lbperson="resend" data-id="' + p.ticketId + '">Resend email</button> · <button class="link" data-lbperson="newlink" data-id="' + p.ticketId + '" data-name="' + esc(p.name) + '">New link</button>' : "") +
    (p.noEmail ? '<div class="flag">No email, share link by hand</div>' : "") + "</td></tr>").join("") || '<tr><td colspan="7" class="small">Nobody has a ticket yet.</td></tr>';
  $("#lbTables").innerHTML = x.tables.length ? '<table><thead><tr><th>Table</th><th>People</th><th>Opened room</th><th>Intro</th><th>Posted</th></tr></thead><tbody>' +
    x.tables.map((t) => "<tr><td><b>" + esc(t.name) + "</b></td><td>" + t.members + "</td><td>" + (st.rooms_open ? t.opened : "–") + "</td><td>" + t.intros + "</td><td>" + t.posted + "</td></tr>").join("") + "</tbody></table>" : '<p class="small">No tables yet.</p>';
  const team = x.people.filter((p) => p.role === "team");
  $("#lbTeamList").innerHTML = team.length ? team.map((p) => '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span><b>' + esc(p.name) + '</b><span class="tiny"> · ' +
    (p.told ? "link sent" : st.open ? "email waiting" : "link goes when the lobby opens") + '</span></span><button type="button" class="link" data-lbteamrm="' + p.ticketId + '" data-name="' + esc(p.name) + '">Remove</button></div>').join("") + '<div style="height:10px"></div>' : "";
  $("#lbLate").hidden = !x.late.length;
  $("#lbLateList").innerHTML = x.late.map((p) => "<div>" + esc(p.name) + ' <span class="tiny mono">' + esc(p.ref) + "</span></div>").join("");
  $("#lbMsgs").innerHTML = x.messages.map((m) => '<div class="lmsg' + (m.hidden ? " hid" : "") + '"><b>' + esc(m.who) + "</b>" + (m.role ? " (" + esc(m.role) + ")" : "") + ' <span class="tiny">in ' + esc(m.space) + ", " + esc(when(m.at)) + "</span>" +
    ' <button class="link" data-lbhide="' + m.id + '" data-hidden="' + (m.hidden ? 0 : 1) + '">' + (m.hidden ? "Restore" : "Hide") + '</button><div style="margin-top:3px;white-space:pre-wrap">' + esc(m.body) + "</div></div>").join("") || '<p class="small">No messages yet.</p>';
}
function lbEdit(id) {
  const p = lbData.posts.find((x) => x.id === id), f = $("#lbPostForm");
  f.postId.value = id; f.sendAt.value = abuja(p.sendAt); f.audience.value = p.audience; f.body.value = p.body;
  $("#lbPostHead").textContent = "Edit post"; $("#lbPostCancel").hidden = false; f.scrollIntoView({ behavior: "smooth" });
}
function lbResetForm() { const f = $("#lbPostForm"); f.reset(); f.postId.value = ""; $("#lbPostHead").textContent = "Add a post"; $("#lbPostCancel").hidden = true; }
$("#lbPostCancel").addEventListener("click", lbResetForm);
$("#lbPostForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  try { await loadLobby(await call("lobby-post", { id: f.postId.value ? Number(f.postId.value) : undefined, sendAt: f.sendAt.value, audience: f.audience.value, body: f.body.value })); lbResetForm(); msg("Post saved.", true); }
  catch (err) { msg(err.message); }
});
$("#lbTeam").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  try {
    const r = await call("lobby-team", { name: f.name.value, email: f.email.value });
    await loadLobby(r); f.reset();
    msg(r.open ? (r.sent ? "Added. Their lobby link has been emailed." : "Added, but the email did not send. Use Resend email in People.") : "Added. Their link goes out with everyone else's when you open the lobby.", r.sent || !r.open);
  } catch (err) { msg(err.message); }
});
$("#lbLinks").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  try { await loadLobby(await call("lobby-settings", { meet_link: f.meet_link.value.trim(), explainer_link: f.explainer_link.value.trim(), close_at: f.close_at.value })); msg("Saved.", true); }
  catch (err) { msg(err.message); }
});
$("#lobbyView").addEventListener("click", async (e) => {
  const el = (s) => e.target.closest(s);
  try {
    if (el("[data-lb]")) {
      const a = el("[data-lb]").dataset.lb;
      if (a === "open") {
        if (!confirm("Open the lobby and email " + lbData.welcomeWaiting + (lbData.welcomeWaiting === 1 ? " person" : " people") + " their link? From now on, new tickets carry the lobby link too.")) return;
        const r = await call("lobby-open", {}); await loadLobby(r);
        msg("The lobby is open. " + r.sent + " lobby email" + (r.sent === 1 ? "" : "s") + " sent" + (r.welcomeWaiting ? "; " + r.welcomeWaiting + " follow as the daily allowance frees up." : "."), true); return;
      }
      if (a === "rooms") {
        if (!confirm("Open team rooms and email " + lbData.announceCount + (lbData.announceCount === 1 ? " person" : " people") + "?")) return;
        const r = await call("lobby-rooms", {}); await loadLobby(r); msg("Team rooms are open. " + r.sent + " announcement emails sent.", true); return;
      }
      if (a === "close" && !confirm("Close the lobby and every team room now? They become read only.")) return;
      await loadLobby(await call("lobby-settings", { closed: a === "close" })); msg(a === "close" ? "Closed. Everything is read only now." : "Reopened.", true); return;
    }
    if (el("[data-lbedit]")) return lbEdit(Number(el("[data-lbedit]").dataset.lbedit));
    if (el("[data-lbp]")) {
      const b = el("[data-lbp]"), a = b.dataset.lbp;
      if (a === "send" && !confirm("Send this post now? It appears in the lobby and goes out as a notification.")) return;
      await loadLobby(await call("lobby-post-action", { id: Number(b.dataset.id), action: a })); msg(a === "send" ? "Sent." : a === "cancel" ? "Cancelled." : "Restored.", true); return;
    }
    if (el("[data-lbteamrm]")) {
      const b = el("[data-lbteamrm]");
      if (!confirm("Remove " + b.dataset.name + " from the QLV team? Their link stops working.")) return;
      await loadLobby(await call("lobby-team-remove", { id: Number(b.dataset.lbteamrm) })); msg("Removed.", true); return;
    }
    if (el("[data-lbhide]")) { const b = el("[data-lbhide]"); await loadLobby(await call("lobby-hide", { id: Number(b.dataset.lbhide), hidden: b.dataset.hidden === "1" })); return; }
    if (el("[data-lbcopy]")) { await navigator.clipboard.writeText(el("[data-lbcopy]").dataset.lbcopy); msg("Link copied. It is personal to them, so send it only to that person.", true); return; }
    if (el("[data-lbperson]")) {
      const b = el("[data-lbperson]"), a = b.dataset.lbperson;
      if (a === "newlink" && !confirm("Make a new link for " + b.dataset.name + "? Their old link stops working, and the new one is emailed to them.")) return;
      await loadLobby(await call("lobby-person", { ticketId: Number(b.dataset.id), action: a, email: a === "newlink" })); msg(a === "resend" ? "Lobby email sent again." : "New link made and emailed.", true); return;
    }
  } catch (err) { msg(err.message); }
});
`;
