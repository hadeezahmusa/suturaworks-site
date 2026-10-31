// The lobby and team rooms behind each person's own link (?t=).
// Before teams are announced the link shows the lobby; after admin opens the
// team rooms it shows the person's room, with the lobby on the Everyone tab.
// The wall refreshes every 10 seconds, only while the page is on screen.

import { API } from "../config.js";
import { demoApi, setDemoRooms } from "./demo.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Plain text with web links made clickable, after escaping.
const linkify = (s) => esc(s).replace(/https:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const params = new URLSearchParams(location.search);
const T = params.get("t") || "";
// my/?demo=1: sample people and posts, answered in the browser. Nothing is saved or sent.
const DEMO = params.get("demo") === "1";
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
  if (DEMO) return demoApi(path, body);
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

// One calm line under the title: when things happen, no ticking clock.
function countdown() {
  if (!D || D.state === "before") return;
  const room = D.rooms.find((r) => r.space === space);
  if (room) {
    $("#count").textContent = (room.mentors.length ? `Mentor: ${room.mentors.join(" and ")} · ` : "") + "Saturday from 8:30am, Transcorp Hilton";
    return;
  }
  const days = Math.ceil((Date.parse(D.countdownTo) - Date.now()) / 86400000);
  $("#count").textContent = D.roomsOpen ? "Everyone at QLV 2026"
    : days > 1 ? `Teams are revealed here on Friday at 4:45pm, in ${days} days`
    : days === 1 ? "Teams are revealed here tomorrow at 4:45pm" : "Teams are revealed here today at 4:45pm";
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
  items.push("<p>Your link is personal. Please don't share it.</p>");
  $("#menuBox").innerHTML = items.join("");
  $("#menu").hidden = false;
}

// ---------- the one nudge ----------
// At most one small line at a time, in this order: write your intro, add
// QLV to the home screen, turn on notifications. Each can be dismissed.

function nudgeHtml() {
  if (D.state === "closed") return "";
  if (!D.intro.what && !D.intro.hoping && !store.get("intro-later")) {
    return `<div class="nudge" id="nudge"><span>Say who you are so people know who they're meeting.</span><button data-sec="people" data-focus-intro>Add your intro</button><button class="x" data-act="intro-later" aria-label="Dismiss">×</button></div>`;
  }
  if (!STANDALONE && !store.get("install-later") && (IOS || installEvent || DEMO)) {
    if (IOS) return `<div class="nudge" id="nudge"><span>Add QLV to your home screen: tap <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-label="Share" style="vertical-align:-2px"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg> then Add to Home Screen.</span><button class="x" data-act="install-later" aria-label="Dismiss">×</button></div>`;
    return `<div class="nudge" id="nudge"><span>Keep QLV one tap away.</span><button data-act="install">Add to home screen</button><button class="x" data-act="install-later" aria-label="Dismiss">×</button></div>`;
  }
  if (PUSH_OK && Notification.permission === "default" && (!IOS || STANDALONE) && !store.get(STANDALONE ? "notify-later-app" : "notify-later")) {
    return `<div class="nudge" id="nudge"><span>Get a nudge when your team is revealed.</span><button data-act="notify">Turn on</button><button class="x" data-act="notify-later" aria-label="Dismiss">×</button></div>`;
  }
  return "";
}
function drawNudge() {
  const el = $("#nudge"), html = nudgeHtml();
  if (el) el.outerHTML = html || "";
}

// ---------- views ----------

let section = "chat";
const seenPost = () => Number(store.get("seen-post") || 0);
const newPosts = () => D.posts.filter((p) => p.id > seenPost()).length;

function postsHtml(list) {
  if (!list.length) return '<p class="empty">Nothing yet. Updates from the QLV team appear here.</p>';
  return list.map((p) => `<div class="post" id="post-${p.id}"><div class="t">${esc(p.title)}</div>${p.text ? `<div class="b">${linkify(p.text)}</div>` : ""}<div class="at">${day(p.at)}, ${time(p.at)}</div></div>`).join("");
}
function personHtml(p) {
  return `<div class="person"><div class="n">${esc(p.short)}${p.role ? `<span class="tag">${esc(p.role)}</span>` : ""}</div>${p.org ? `<div class="o">${esc(p.org)}</div>` : ""}
    ${p.what ? `<div class="q">${esc(p.what)}</div>` : ""}${p.hoping ? `<div class="q h">Hoping for: ${esc(p.hoping)}</div>` : ""}</div>`;
}
function msgHtml(m) {
  return `<div class="msg${m.mine ? " mine" : ""}" data-id="${m.id}">${m.mine ? "" : `<div class="w">${esc(m.who)}${m.role ? `<span class="tag">${esc(m.role)}</span>` : ""}</div>`}<div class="x">${esc(m.body)}</div><time>${time(m.at)}</time></div>`;
}

function chatHtml(id, msgs, placeholder, pinned) {
  const shut = D.state === "closed";
  return (shut ? '<div class="closed">This room has closed. Thank you for being part of QLV 2026.</div>' : "") +
    nudgeHtml() +
    (pinned ? `<button class="pin" data-sec="updates"><span class="pk">Latest from QLV</span><span class="pt">${esc(pinned.title)}</span></button>` : "") +
    `<div class="wall" id="wall-${id}">${msgs.length ? msgs.map(msgHtml).join("") : `<p class="empty" data-empty>No messages yet. Say hello 👋🏽</p>`}</div>` +
    (shut ? "" : `<form class="compose" data-compose><textarea maxlength="280" rows="1" placeholder="${esc(placeholder)}" aria-label="Your message"></textarea><button class="send" aria-label="Send"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button><span class="lim" data-lim hidden></span></form>`);
}

function introHtml() {
  const i = D.intro;
  if (D.state === "closed") return "";
  return `<form class="card intro" id="intro"><h2>Your intro</h2>
    <label class="f" for="iWhat">What do you do, and where?</label><textarea id="iWhat" maxlength="140" rows="2" placeholder="For example: I run operations at a logistics firm in Abuja">${esc(i.what)}</textarea>
    <label class="f" for="iHope">What are you hoping to take away?</label><textarea id="iHope" maxlength="140" rows="2">${esc(i.hoping)}</textarea>
    ${i.org ? `<label class="tick"><input type="checkbox" id="iHide"${i.hideOrg ? " checked" : ""}> Hide ${esc(i.org)} from others</label>` : ""}
    <div class="row"><button class="btn">Save</button><span class="ok" id="introOk"></span></div></form>`;
}

function sectionsFor(room) {
  return room ? [["chat", "Chat"], ["team", "Team"]] : [["chat", "Chat"], ["people", "People"], ["updates", "Updates"]];
}
function drawSections(room) {
  const n = room ? 0 : newPosts();
  $("#secs").innerHTML = sectionsFor(room).map(([k, label]) =>
    `<button data-sec="${k}" aria-selected="${section === k}">${label}${k === "updates" && n ? `<i class="dot" aria-label="${n} new"></i>` : ""}</button>`).join("");
}

function sectionHtml(room) {
  if (room) {
    if (section === "team") {
      return (D.roomPosts.length ? `<section class="card">${postsHtml(D.roomPosts)}</section>` : "") +
        `<section class="card room-hero"><div class="nm">${esc(room.name)}</div>
        <p>${room.mentors.length ? `Your mentor: ${room.mentors.map(esc).join(" and ")}` : "Your mentor joins you on Saturday."}</p>
        <div class="sat">${esc(D.saturday)}</div></section>` +
        `<section class="card"><h2>Your teammates</h2><div class="people">${room.members.map(personHtml).join("") || '<p class="empty">Your teammates appear here.</p>'}</div></section>`;
    }
    return chatHtml(room.space.replace(":", "-"), room.messages, `Message ${room.name}`, D.roomPosts[0]);
  }
  if (section === "people") return introHtml() + `<section class="card"><h2>Who's coming</h2><div class="people">${D.people.map(personHtml).join("")}</div></section>`;
  if (section === "updates") return `<section class="card"><h2>From the QLV team</h2>${postsHtml(D.posts)}</section>`;
  return (D.me.note ? `<div class="closed">${esc(D.me.note)}</div>` : "") + chatHtml("lobby", D.lobby, "Say hello to everyone", D.posts[0]);
}

function show(next, sec) {
  space = next;
  const room = D.rooms.find((r) => r.space === space);
  if (!room) space = "lobby";
  if (sec) section = sec;
  if (!sectionsFor(room).some(([k]) => k === section)) section = "chat";
  $("#eyebrow").textContent = room ? "QLV 2026 · Your team" : "QLV 2026 · Lobby";
  $("#title").textContent = room ? room.name : "The lobby";
  countdown();
  drawTabs();
  drawSections(room);
  $("#main").innerHTML = sectionHtml(room);
  document.body.classList.toggle("chatting", section === "chat");
  bindCompose();
  if (section === "updates" && D.posts.length) { store.set("seen-post", String(Math.max(...D.posts.map((p) => p.id)))); drawSections(room); }
  if (section === "chat") requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  else window.scrollTo(0, 0);
  const list = room ? room.messages : D.lobby;
  lastId[space] = list.length ? list.at(-1).id : lastId[space] || 0;
  if (location.hash !== "#" + space && !location.hash.startsWith("#post-")) history.replaceState(null, "", (DEMO ? "?demo=1" : "?t=" + encodeURIComponent(T) + (params.get("app") ? "&app=1" : "")) + "#" + space);
}

function bindCompose() {
  const intro = $("#intro");
  if (intro) {
    intro.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = intro.querySelector("button");
      btn.disabled = true;
      try {
        await api("/api/my-intro", { what: $("#iWhat").value, hoping: $("#iHope").value, hideOrg: !!$("#iHide")?.checked });
        D.intro = { ...D.intro, what: $("#iWhat").value.trim(), hoping: $("#iHope").value.trim(), hideOrg: !!$("#iHide")?.checked };
        const me = D.people.find((p) => p.short === "You") || D.people.find((p) => p.short === D.me.short);
        if (me) Object.assign(me, { what: D.intro.what, hoping: D.intro.hoping, org: D.intro.hideOrg ? "" : D.intro.org });
        show(space, "people");
        $("#introOk").textContent = "Saved. Everyone in the lobby can see it.";
      } catch (err) { alert(err.message); } finally { btn.disabled = false; }
    });
  }
  const form = $("[data-compose]");
  if (!form) return;
  const ta = form.querySelector("textarea"), lim = $("[data-lim]");
  ta.addEventListener("input", () => {
    lim.hidden = ta.value.length < 240;
    lim.textContent = 280 - ta.value.length;
    ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px";
  });
  ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !IOS && matchMedia("(pointer: fine)").matches) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body || sending) return;
    sending = true;
    form.querySelector("button").disabled = true;
    try {
      const r = await api("/api/my-post", { space, body });
      ta.value = ""; ta.style.height = "auto"; lim.hidden = true;
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
  const near = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
  wall.querySelector("[data-empty]")?.remove();
  wall.insertAdjacentHTML("beforeend", fresh.map(msgHtml).join(""));
  if (near || fresh.some((m) => m.mine)) window.scrollTo(0, document.body.scrollHeight);
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
  if (D && D.state !== "before" && section === "chat" && !$("#nudge")) show(space);
});
window.addEventListener("appinstalled", () => { store.set("install-later", "1"); if (D) drawNudge(); api("/api/my-push", { installed: true }).catch(() => {}); });

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
  if (tab) { show(tab.dataset.space, "chat"); refresh(); return; }
  const sec = e.target.closest("[data-sec]");
  if (sec) {
    show(space, sec.dataset.sec);
    if (sec.hasAttribute("data-focus-intro")) $("#iWhat")?.focus();
    return;
  }
  const act = e.target.closest("[data-act]")?.dataset.act;
  if (!act) return;
  if (DEMO && (act === "install" || act === "notify")) {
    alert(act === "install" ? "On a real phone, the phone's own \"Add to home screen\" box appears here." : "On a real phone, the phone asks permission here, and only after this tap.");
    return;
  }
  if (act === "install" && installEvent) {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    installEvent = null;
    if (outcome === "accepted") { store.set("install-later", "1"); drawNudge(); }
  }
  if (act === "intro-later") { store.set("intro-later", "1"); drawNudge(); }
  if (act === "install-later") { store.set("install-later", "1"); drawNudge(); drawMenu(); }
  if (act === "install-again") { store.set("install-later", ""); store.set("intro-later", "1"); $("#menu").open = false; show(space, "chat"); }
  if (act === "notify-later") { store.set(STANDALONE ? "notify-later-app" : "notify-later", "1"); drawNudge(); }
  if (act === "notify") {
    // The phone's own prompt appears only now, after the tap.
    const result = await Notification.requestPermission();
    store.set(STANDALONE ? "notify-later-app" : "notify-later", "1");
    drawNudge();
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
  show(start, keepSpace ? section : hash.startsWith("post-") ? "updates" : "chat");
  if (hash.startsWith("post-")) { const el = document.getElementById(hash); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } }
  if (navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  // A phone that already allowed notifications re-subscribes quietly.
  if (PUSH_OK && Notification.permission === "granted") subscribe().catch(() => {});
}

if (DEMO) {
  // A bar across the top to switch between before and after the announcement.
  document.body.insertAdjacentHTML("afterbegin", `<div class="demobar"><span>Demo · sample people · nothing is saved or sent</span>
    <span class="seg"><button data-demo="lobby" aria-pressed="true">Lobby, before Friday</button><button data-demo="rooms" aria-pressed="false">Team rooms open</button></span></div>`);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-demo]");
    if (!b) return;
    setDemoRooms(b.dataset.demo === "rooms");
    document.querySelectorAll("[data-demo]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    history.replaceState(null, "", "?demo=1");
    load();
    window.scrollTo(0, 0);
  });
  load();
  setInterval(countdown, 30000);
  setInterval(refresh, 3000);
} else if (!T) {
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
