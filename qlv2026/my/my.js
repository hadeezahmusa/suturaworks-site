// The lobby and team rooms behind each person's own link (?t=).
// Before teams are announced the link shows the lobby; after admin opens the
// team rooms it shows the person's room, with the lobby on the Everyone tab.
// The wall refreshes every 10 seconds, only while the page is on screen.

import { API } from "../config.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Plain text with web links made clickable, after escaping.
const linkify = (s) => esc(s).replace(/https:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const params = new URLSearchParams(location.search);
const T = params.get("t") || "";
const STANDALONE = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const PUSH_OK = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const store = {
  get: (k) => { try { return localStorage.getItem("qlv-" + k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem("qlv-" + k, v); } catch { /* private mode */ } },
};

let D = null, space = "lobby", installEvent = null, sending = false;
const lastId = {};

async function api(path, body) {
  let res;
  try {
    res = await fetch(API + path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: T, ...body }) } : {});
  } catch {
    throw new Error("We could not reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || "Something went wrong. Try again in a minute."); e.code = data.code; throw e; }
  return data;
}
const time = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" }).replace(/\s/g, "").toLowerCase();
const day = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });

// ---------- sign in without a link ----------

function signInPage(note) {
  $("#title").textContent = "Find your link";
  $("#main").innerHTML = `<form class="card" id="si"><h2>Sign in with your ticket</h2>
    <p class="sub">Use the reference on your ticket and the email you registered with. We'll take you to your own lobby link.</p>
    ${note ? `<div class="err" style="margin:0 0 12px">${esc(note)}</div>` : ""}
    <label class="f" for="siRef">Ticket reference</label><input type="text" id="siRef" autocomplete="off" autocapitalize="characters" placeholder="QLV26-000" required style="margin:0 0 12px">
    <label class="f" for="siEmail">Email you registered with</label><input type="email" id="siEmail" autocomplete="email" required style="margin:0 0 14px">
    <button class="btn">Open my lobby</button></form>`;
  $("#si").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#si button");
    btn.disabled = true;
    try {
      const r = await fetch(API + "/api/my-signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: $("#siRef").value, email: $("#siEmail").value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return signInPage(d.error || "That did not work. Try again.");
      location.replace("?t=" + encodeURIComponent(d.token));
    } catch { signInPage("We could not reach the server. Check your connection."); }
  });
}

// ---------- header ----------

function countdown() {
  if (!D?.countdownTo || D.roomsOpen) return;
  const ms = Date.parse(D.countdownTo) - Date.now();
  if (ms <= 0) { $("#count").innerHTML = "Day one is live. " + esc(D.announceLabel); return; }
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
  $("#count").innerHTML = `Day one starts in <b>${d ? d + "d " : ""}${h}h ${String(m).padStart(2, "0")}m</b>, Friday 6 November at 4:00pm. ${esc(D.announceLabel)}`;
}

function drawTabs() {
  const tabs = $("#tabs");
  if (!D.rooms.length) { tabs.hidden = true; return; }
  tabs.hidden = false;
  tabs.innerHTML = D.rooms.map((r) => `<button role="tab" data-space="${esc(r.space)}" aria-selected="${space === r.space}">${esc(r.name)}</button>`).join("") +
    `<button role="tab" data-space="lobby" aria-selected="${space === "lobby"}">Everyone</button>`;
}

function drawMenu() {
  const items = [];
  if (PUSH_OK && Notification.permission === "denied") items.push("<p>Notifications are off. You can turn them on in your phone's settings.</p>");
  if (PUSH_OK && Notification.permission === "granted") items.push("<p>Notifications are on for this phone.</p>");
  if (!STANDALONE && store.get("install-later")) items.push('<p><button data-act="install-again">Add QLV to your home screen</button></p>');
  if (!items.length) items.push("<p>Your link is personal. Please don't share it.</p>");
  $("#menuBox").innerHTML = items.join("");
  $("#menu").hidden = false;
}

// ---------- cards ----------

function installCard() {
  if (STANDALONE || store.get("install-later")) return "";
  if (IOS) {
    return `<div class="card prompt" id="installCard"><h2>Add QLV to your home screen</h2>
      <div class="steps"><span class="share"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg></span><span>Tap the Share button, then <b>Add to Home Screen</b>.</span></div>
      ${PUSH_OK || IOS ? "<p>Add QLV to your home screen to get notifications.</p>" : ""}
      <button class="btn ghost" style="color:#CFE0F3;padding-left:0" data-act="install-later">Not now</button></div>`;
  }
  if (!installEvent) return "";
  return `<div class="card prompt" id="installCard"><h2>Keep QLV one tap away</h2><p>Your team room will be right there on Friday.</p>
    <div class="row"><button class="btn gold" data-act="install">Add QLV to your home screen</button><button class="btn ghost" style="color:#CFE0F3" data-act="install-later">Not now</button></div></div>`;
}

function notifyCard() {
  if (!PUSH_OK || Notification.permission !== "default") return "";
  if (IOS && !STANDALONE) return "";
  const key = STANDALONE ? "notify-later-app" : "notify-later";
  if (store.get(key)) return "";
  return `<div class="card prompt" id="notifyCard"><h2>Turn on notifications</h2><p>Get a nudge when your team is announced and when your teammates post.</p>
    <div class="row"><button class="btn gold" data-act="notify">Turn on notifications</button><button class="btn ghost" style="color:#CFE0F3" data-act="notify-later">Not now</button></div></div>`;
}

// ---------- views ----------

function postsHtml(list) {
  if (!list.length) return '<p class="empty">Nothing yet. Updates from the QLV team appear here.</p>';
  return list.map((p) => `<div class="post" id="post-${p.id}"><div class="t">${esc(p.title)}</div>${p.text ? `<div class="b">${linkify(p.text)}</div>` : ""}<div class="at">${day(p.at)}, ${time(p.at)}</div></div>`).join("");
}
function personHtml(p) {
  return `<div class="person"><div class="n">${esc(p.short)}${p.role ? `<span class="tag">${esc(p.role)}</span>` : ""}</div>${p.org ? `<div class="o">${esc(p.org)}</div>` : ""}
    ${p.what ? `<div class="q"><span>What I do</span>${esc(p.what)}</div>` : ""}${p.hoping ? `<div class="q"><span>Hoping to take away</span>${esc(p.hoping)}</div>` : ""}</div>`;
}
function msgHtml(m) {
  return `<div class="msg${m.mine ? " mine" : ""}" data-id="${m.id}"><div class="w">${esc(m.mine ? "You" : m.who)}${m.role ? `<span class="tag">${esc(m.role)}</span>` : ""}<time>${time(m.at)}</time></div><div class="x">${esc(m.body)}</div></div>`;
}
function wallHtml(id, msgs, placeholder) {
  const shut = D.state === "closed";
  return `<div class="wall" id="wall-${id}">${msgs.length ? msgs.map(msgHtml).join("") : `<p class="empty" data-empty>Nobody has posted yet. Be the first.</p>`}</div>
    ${shut ? "" : `<form class="compose" data-compose><textarea maxlength="280" rows="1" placeholder="${esc(placeholder)}" aria-label="Your message"></textarea><button class="btn">Send</button></form><div class="lim" data-lim>0 / 280</div>`}`;
}

function lobbyView() {
  const shut = D.state === "closed";
  const i = D.intro;
  return (shut ? '<div class="closed">This room has closed. Thank you for being part of QLV 2026.</div>' : "") +
    (D.me.note ? `<div class="closed">${esc(D.me.note)}</div>` : "") +
    (shut ? "" : installCard() + notifyCard()) +
    `<section class="card"><h2>From the QLV team</h2>${postsHtml(D.posts)}</section>` +
    (shut ? "" : `<form class="card" id="intro"><h2>Your intro</h2><p class="sub">So people know who they're meeting. You can change it any time.</p>
      <label class="f" for="iWhat">What do you do, and where?</label><textarea id="iWhat" maxlength="140" rows="2">${esc(i.what)}</textarea><div class="lim"><span>${i.what.length}</span> / 140</div>
      <label class="f" for="iHope">What are you hoping to take away from QLV?</label><textarea id="iHope" maxlength="140" rows="2">${esc(i.hoping)}</textarea><div class="lim"><span>${i.hoping.length}</span> / 140</div>
      ${i.org ? `<label class="tick"><input type="checkbox" id="iHide"${i.hideOrg ? " checked" : ""}> Hide my organisation (${esc(i.org)}) from others</label>` : ""}
      <div class="row"><button class="btn">Save my intro</button><span class="ok" id="introOk"></span></div></form>`) +
    `<section class="card"><h2>Who's coming</h2><div class="people">${D.people.map(personHtml).join("")}</div></section>` +
    `<section class="card"><h2>Say hello</h2>${wallHtml("lobby", D.lobby, "Say hello to everyone")}</section>`;
}

function roomView(r) {
  const shut = D.state === "closed";
  return (shut ? '<div class="closed">This room has closed. Thank you for being part of QLV 2026.</div>' : "") +
    (D.roomPosts.length ? `<section class="card">${postsHtml(D.roomPosts)}</section>` : "") +
    `<section class="card room-hero"><div class="k">Your team</div><div class="nm">${esc(r.name)}</div>
      <p>${r.mentors.length ? `Mentor: ${r.mentors.map(esc).join(" and ")}` : "Your mentor joins you on Saturday."}</p>
      <div class="sat">${esc(D.saturday)}</div></section>` +
    (shut ? "" : installCard() + notifyCard()) +
    `<section class="card"><h2>Your teammates</h2><div class="people">${r.members.map(personHtml).join("") || '<p class="empty">Your teammates appear here.</p>'}</div></section>` +
    `<section class="card"><h2>Team chat</h2>${wallHtml(r.space.replace(":", "-"), r.messages, "Message your team")}</section>`;
}

function show(next) {
  space = next;
  const room = D.rooms.find((r) => r.space === space);
  if (!room) space = "lobby";
  $("#eyebrow").textContent = room ? "QLV 2026 · Team room" : "QLV 2026 · Lobby";
  $("#title").textContent = room ? `Hi ${D.me.first}` : `Welcome, ${D.me.first}`;
  $("#count").hidden = !!D.roomsOpen;
  $("#main").innerHTML = room ? roomView(room) : lobbyView();
  drawTabs();
  bindCompose();
  for (const w of document.querySelectorAll(".wall")) w.scrollTop = w.scrollHeight;
  const list = room ? room.messages : D.lobby;
  lastId[space] = list.length ? list.at(-1).id : lastId[space] || 0;
  if (location.hash !== "#" + space && !location.hash.startsWith("#post-")) history.replaceState(null, "", "?t=" + encodeURIComponent(T) + (params.get("app") ? "&app=1" : "") + "#" + space);
}

function bindCompose() {
  const intro = $("#intro");
  if (intro) {
    intro.querySelectorAll("textarea").forEach((ta) => ta.addEventListener("input", () => { ta.nextElementSibling.querySelector("span").textContent = ta.value.length; }));
    intro.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = intro.querySelector("button");
      btn.disabled = true;
      try {
        await api("/api/my-intro", { what: $("#iWhat").value, hoping: $("#iHope").value, hideOrg: !!$("#iHide")?.checked });
        D.intro = { ...D.intro, what: $("#iWhat").value.trim(), hoping: $("#iHope").value.trim(), hideOrg: !!$("#iHide")?.checked };
        $("#introOk").textContent = "Saved";
        setTimeout(() => { const ok = $("#introOk"); if (ok) ok.textContent = ""; }, 2500);
      } catch (err) { alert(err.message); } finally { btn.disabled = false; }
    });
  }
  const form = $("[data-compose]");
  if (!form) return;
  const ta = form.querySelector("textarea"), lim = $("[data-lim]");
  ta.addEventListener("input", () => { lim.textContent = ta.value.length + " / 280"; ta.style.height = "46px"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !IOS && matchMedia("(pointer: fine)").matches) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body || sending) return;
    sending = true;
    form.querySelector("button").disabled = true;
    try {
      const r = await api("/api/my-post", { space, body });
      ta.value = "";
      lim.textContent = "0 / 280";
      addMessages(space, [r.message]);
    } catch (err) {
      alert(err.message);
      if (err.code === "closed") load();
    } finally { sending = false; form.querySelector("button").disabled = false; }
  });
}

function addMessages(sp, list) {
  const shown = sp === "lobby" ? D.lobby : D.rooms.find((r) => r.space === sp)?.messages;
  if (!shown) return;
  const fresh = list.filter((m) => !shown.some((x) => x.id === m.id));
  if (!fresh.length) return;
  shown.push(...fresh);
  lastId[sp] = Math.max(lastId[sp] || 0, ...fresh.map((m) => m.id));
  const wall = $("#wall-" + sp.replace(":", "-"));
  if (!wall || sp !== space) return;
  const near = wall.scrollHeight - wall.scrollTop - wall.clientHeight < 120;
  wall.querySelector("[data-empty]")?.remove();
  wall.insertAdjacentHTML("beforeend", fresh.map(msgHtml).join(""));
  if (near || fresh.some((m) => m.mine)) wall.scrollTop = wall.scrollHeight;
}

async function refresh() {
  if (document.hidden || !D || D.state === "before") return;
  try {
    const r = await api(`/api/my-wall?t=${encodeURIComponent(T)}&space=${encodeURIComponent(space)}&after=${lastId[space] || 0}`);
    addMessages(space, r.messages);
    // Rooms opened or the lobby closed since this page loaded: reload it all.
    if (r.roomsOpen !== D.roomsOpen || (r.closed && D.state !== "closed")) load(true);
  } catch { /* try again next time */ }
}

// ---------- install and notifications ----------

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  if (D && D.state !== "before" && !$("#installCard")) show(space);
});
window.addEventListener("appinstalled", () => { store.set("install-later", "1"); $("#installCard")?.remove(); api("/api/my-push", { installed: true }).catch(() => {}); });

function b64ToBytes(s) {
  const b = atob((s + "===".slice((s.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
async function subscribe(state = "on") {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(D.push.key) });
  await api("/api/my-push", { subscription: sub.toJSON(), state, installed: STANDALONE });
}

document.addEventListener("click", async (e) => {
  const tab = e.target.closest("[data-space]");
  if (tab) { show(tab.dataset.space); refresh(); window.scrollTo(0, 0); return; }
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  if (act === "install" && installEvent) {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    if (outcome === "accepted") $("#installCard")?.remove();
  }
  if (act === "install-later") { store.set("install-later", "1"); $("#installCard")?.remove(); drawMenu(); }
  if (act === "install-again") { store.set("install-later", ""); $("#menu").open = false; show(space); window.scrollTo(0, 0); }
  if (act === "notify-later") { store.set(STANDALONE ? "notify-later-app" : "notify-later", "1"); $("#notifyCard")?.remove(); }
  if (act === "notify") {
    // The phone's own prompt appears only now, after the tap.
    const result = await Notification.requestPermission();
    $("#notifyCard")?.remove();
    if (result === "granted") { try { await subscribe(); } catch { alert("Notifications could not be turned on on this phone."); } }
    else api("/api/my-push", { state: result === "denied" ? "denied" : "off" }).catch(() => {});
    drawMenu();
  }
});

// ---------- start ----------

async function load(keepSpace) {
  try {
    D = await api(`/api/my?t=${encodeURIComponent(T)}${STANDALONE ? "&app=1" : ""}`);
  } catch (err) {
    if (err.code === "bad_link") return signInPage(err.message);
    $("#main").innerHTML = `<div class="err">${esc(err.message)}</div>`;
    return;
  }
  if (D.state === "before") {
    $("#title").textContent = `Hi ${D.me.first}`;
    $("#main").innerHTML = '<div class="card hold"><h2>The QLV lobby opens soon</h2><p>We\'ll email you as soon as it does. Your link stays the same.</p></div>';
    return;
  }
  drawMenu();
  const hash = decodeURIComponent(location.hash.slice(1));
  const start = keepSpace ? space : hash.startsWith("t:") ? hash : hash === "lobby" || hash.startsWith("post-") ? "lobby" : D.rooms[0]?.space || "lobby";
  show(start);
  countdown();
  if (hash.startsWith("post-")) { const el = document.getElementById(hash); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } }
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  // A phone that already allowed notifications re-subscribes quietly.
  if (PUSH_OK && Notification.permission === "granted") subscribe().catch(() => {});
}

if (!T) {
  signInPage();
} else {
  // The home screen app gets a manifest made for this person, so its icon opens this link.
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = `${API}/api/manifest?t=${encodeURIComponent(T)}`;
  document.head.appendChild(link);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
  load();
  setInterval(countdown, 30000);
  setInterval(refresh, 10000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    refresh();
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  });
}
