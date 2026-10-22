// The projector display. It follows the shared stage state on the server,
// polling every second. The clock is worked out from the stored end time,
// never counted down here, so it always agrees with the control page; if the
// connection drops it keeps running from the last state it had and shows a
// small "reconnecting" mark. It never goes blank.
//
// Public data only: table names and times. No participant names, no scores
// below the top three, nothing from payments.

import { API } from "./config.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const K = new URLSearchParams(location.search).get("k") || "";
// stage.html?demo=1 plays the whole day with sample tables and fast clocks,
// without a link or the server. Nothing it does reaches the live stage.
const DEMO = new URLSearchParams(location.search).get("demo") === "1";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

let st = null, data = null, offset = 0, lastOk = 0, sceneKey = "", slide = 0, slideTimer = null, hopTimer = null;
let soundOn = false, lastTest = null, cueKey = "", prevRem = null;
const audio = { chime: new Audio("assets/sounds/chime.mp3"), gong: new Audio("assets/sounds/gong.mp3") };
audio.chime.preload = audio.gong.preload = "auto";

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const mmss = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return pad(Math.floor(s / 60)) + ":" + pad(s % 60); };
const clockAt = (ms) => new Date(ms + 3600000).toISOString().slice(11, 16).replace(/^0/, "");
// In the demo, time runs faster during the timed rounds so a 50-minute
// sprint plays in a minute; the clock maths stays exactly the same.
const demoTime = { v0: 0, r0: 0, speed: 1 };
const now = () => DEMO ? demoTime.v0 + (Date.now() - demoTime.r0) * demoTime.speed : Date.now() + offset;
function remaining() {
  if (!st) return null;
  const c = st.clock;
  if (c.pausedMs !== null && c.pausedMs !== undefined) return c.pausedMs;
  if (!c.endsAt) return null;
  return Math.max(0, c.endsAt - now());
}
const paused = () => st && st.clock.pausedMs !== null && st.clock.pausedMs !== undefined;
function play(name) {
  if (!soundOn) return;
  const a = audio[name];
  try { a.currentTime = 0; a.play().catch(() => {}); } catch { /* ignore */ }
}
function flash() {
  if (reduced) return;
  const f = $("#flash");
  f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
}
function banner(text) {
  $("#banner").innerHTML = '<div class="banner"><span>' + esc(text) + "</span></div>";
  setTimeout(() => { $("#banner").innerHTML = ""; }, 6200);
}

// ---------- fit to the screen ----------
function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $("#screen").style.transform = "translate(-50%, -50%) scale(" + s + ")";
}
addEventListener("resize", fit);
fit();

// ---------- the ring clock ----------
const RING = { r: 0, c: 0 };
function ringHTML(size, stroke, label) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  RING.r = r; RING.c = c;
  return '<div class="ring" id="ring" style="width:' + size + "px;height:" + size + 'px"><svg width="' + size + '" height="' + size + '"><circle class="track" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
    '<circle class="arc" id="arc" cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" stroke-width="' + stroke + '" stroke-dasharray="' + c + '" stroke-dashoffset="0"/></svg>' +
    '<div class="face">' + (label ? '<span class="label">' + esc(label) + "</span>" : "") + '<span class="time" id="ringTime" style="font-size:' + Math.round(size * 0.27) + 'px">--:--</span><span class="of" id="ringOf"></span></div><span class="paused" id="ringPaused" hidden>PAUSED</span></div>';
}
function updateRing(amberAt) {
  const ring = $("#ring");
  if (!ring) return;
  const rem = remaining(), total = st.clock.totalMs || 1;
  $("#ringTime").textContent = rem === null ? "--:--" : mmss(rem);
  $("#ringOf").textContent = rem === null ? "" : "of " + mmss(total);
  $("#arc").setAttribute("stroke-dashoffset", String(RING.c * (1 - (rem || 0) / total)));
  ring.classList.toggle("amber", rem !== null && rem > 0 && rem <= amberAt);
  ring.classList.toggle("zero", rem === 0);
  ring.classList.toggle("pulse", !reduced && rem !== null && rem > 0 && rem <= 60000 && !paused());
  $("#ringPaused").hidden = !paused();
}

// ---------- scenes ----------
function floaters(names) {
  const list = names.length ? names : ["Foundation", "Blueprint", "Scaffold", "Keystone", "Pillar", "Legacy"];
  return '<div class="floaters" aria-hidden="true">' + list.concat(list).map((n, i) =>
    '<span style="left:' + ((i * 137) % 1700) + "px;animation-duration:" + (22 + (i % 5) * 4) + "s;animation-delay:-" + (i * 3.1) + 's">' + esc(n) + "</span>").join("") + "</div>";
}

function arrivalSlides() {
  const s = ["welcome"];
  if (st.toggles.partners && data.partners.length) s.push("thanks");
  if (st.toggles.animation) s.push("opening");
  return s;
}

function sceneArrival() {
  const slides = arrivalSlides();
  const which = slides[slide % slides.length];
  if (which === "thanks") return thanksHTML("Thank you to our partners");
  if (which === "opening") return openingHTML();
  const sched = st.toggles.schedule ? '<div class="sched"><b>Today</b>' + data.schedule.map((x, i) => '<div style="animation-delay:' + (0.3 + i * 0.12) + 's"><span>' + esc(x.t) + "</span><span>" + esc(x.what) + "</span></div>").join("") + "</div>" : "";
  return floaters(data.order.map((o) => o.name)) + '<div class="arrival"><div class="l"><span class="eyebrow">Welcome to QLV 2026</span><span class="big" style="font-size:' + (sched ? 96 : 120) + 'px">Find your table by the name on your badge.</span>' +
    '<span class="lede">Tea and light snacks are served. The sprint opens at ' + esc((data.schedule.find((x) => /sprint/i.test(x.what)) || { t: "10:50" }).t) + ".</span></div>" + sched + "</div>";
}

function thanksHTML(title) {
  return '<div class="thanks"><span class="eyebrow">With thanks</span><span class="big" style="font-size:88px">' + esc(title) + '</span><div class="names">' +
    data.partners.map((p, i) => '<span style="animation-delay:' + (0.4 + i * 0.25) + 's">' + esc(p) + "</span>").join("") + "</div></div>";
}

function openingHTML() {
  return '<div class="opening"><section id="landing" class="on"><div class="lp-stage"><div class="lp-inner" id="lpSeq">' +
    '<div class="lp-chapter"><img src="assets/jci-aso-white.png" alt="" width="176" height="85"></div>' +
    '<div class="lp-frame"><svg class="lp-scaffold" viewBox="0 0 520 250" aria-hidden="true" preserveAspectRatio="xMidYMid meet">' +
    '<path class="lp-s1" pathLength="1" d="M58 26 L58 224"></path><path class="lp-s2" pathLength="1" d="M462 26 L462 224"></path><path class="lp-s3" pathLength="1" d="M58 26 L462 26"></path><path class="lp-s4" pathLength="1" d="M58 224 L462 224"></path>' +
    '<path class="lp-s5" pathLength="1" d="M58 26 L176 125"></path><path class="lp-s6" pathLength="1" d="M462 26 L344 125"></path><path class="lp-s7" pathLength="1" d="M58 224 L176 125"></path><path class="lp-s8" pathLength="1" d="M462 224 L344 125"></path>' +
    '<circle class="lp-node lp-n1" cx="58" cy="26" r="4"></circle><circle class="lp-node lp-n2" cx="462" cy="26" r="4"></circle><circle class="lp-node lp-n3" cx="58" cy="224" r="4"></circle><circle class="lp-node lp-n4" cx="462" cy="224" r="4"></circle></svg>' +
    '<div class="lp-mark"><img src="assets/qlv-white.png" alt="" width="262" height="161"></div></div>' +
    '<h1 class="lp-theme">Building systems that <span class="lp-held">outlive</span> you</h1></div></div></section></div>';
}

function buildingSVG() {
  // Ten floors outlined in blueprint, filled in as the sprint runs; a crane swings overhead.
  let outline = "";
  for (let i = 0; i < 10; i++) outline += '<rect x="250" y="' + (262 - i * 26) + '" width="170" height="24" rx="3"/>';
  return '<div class="build" id="build"><svg width="760" height="300" viewBox="0 0 760 300" aria-hidden="true">' +
    '<line x1="0" y1="288" x2="760" y2="288" stroke="rgba(143,182,232,.35)" stroke-width="3"/>' +
    '<g class="outline">' + outline + '</g><g id="floors"></g>' +
    '<g class="crane"><line class="crane" x1="470" y1="288" x2="470" y2="30"/><line class="crane" x1="458" y1="288" x2="458" y2="40" opacity=".5"/>' +
    '<g class="jib"><line class="crane" x1="380" y1="40" x2="700" y2="40"/><line class="crane" x1="470" y1="10" x2="700" y2="40" opacity=".6"/><line class="crane" x1="470" y1="10" x2="380" y2="40" opacity=".6"/>' +
    '<g class="hook"><line class="crane" x1="640" y1="40" x2="640" y2="110" stroke-width="2"/><rect x="622" y="110" width="36" height="16" rx="3" fill="rgba(239,194,45,.85)"/></g></g></g>' +
    '<g class="flag"><line x1="335" y1="2" x2="335" y2="-56" stroke="#F2F6FC" stroke-width="4"/><path d="M335 -56 L395 -42 L335 -28 Z" fill="#EFC22D"/><text x="404" y="-36" font-family="Poppins" font-weight="700" font-size="20" fill="#EFC22D">Plan locked</text></g>' +
    "</svg>" + [0, 1, 2, 3, 4].map((i) => '<span class="spark" style="left:' + (290 + i * 26) + "px;top:" + 150 + "px;--dx:" + (i * 30 - 60) + "px;animation-delay:" + i * 0.45 + 's"></span>').join("") + "</div>";
}

function updateBuilding() {
  const b = $("#build");
  if (!b) return;
  const rem = remaining(), total = st.clock.totalMs || 1;
  const want = rem === null ? 0 : Math.min(10, Math.floor(((total - rem) / total) * 10 + 0.0001) + (rem === 0 ? 0 : 0));
  const g = $("#floors");
  while (g.children.length < want) {
    const i = g.children.length;
    const y = 262 - i * 26;
    const f = document.createElementNS("http://www.w3.org/2000/svg", "g");
    f.innerHTML = '<rect class="floor' + (i % 3 === 2 ? " w" : "") + '" x="250" y="' + y + '" width="170" height="24" rx="3"/>' + [0, 1, 2, 3].map((k) => '<rect class="win" x="' + (264 + k * 40) + '" y="' + (y + 6) + '" width="24" height="12" rx="2"/>').join("");
    g.appendChild(f);
  }
  while (g.children.length > want) g.lastChild.remove();
  b.classList.toggle("done", rem === 0 || want >= 10);
}

function sceneRound(kind) {
  const endsAt = st.clock.endsAt || (now() + (st.clock.pausedMs || 0));
  let right = "";
  if (kind === "sprint") {
    const half = endsAt - st.clock.totalMs / 2;
    right = '<span class="big">Your plan has to work without you in the room.</span><div class="cues">' +
      '<span id="cueHalf">Halfway chime at ' + clockAt(half) + "</span><span id=\"cueFive\">Five-minute call at " + clockAt(endsAt - 300000) + '</span><span class="last">Pens down and hand over at ' + clockAt(endsAt) + "</span></div>" + buildingSVG();
  } else if (kind === "critique") {
    right = '<span class="big">Find the gaps.</span><span class="lede">You are reviewing another team’s plan. Gap, question, strength. Critiques go back at ' + clockAt(endsAt) + '.</span>' +
      '<div style="position:relative;margin-top:20px"><div class="paper"><i class="h"></i><i></i><i class="m"></i><i class="s"></i><i></i><i class="m"></i><div class="glass"></div>' +
      '<div class="tags"><span class="g">Gap</span><span class="q">Question</span><span class="st">Strength</span></div></div></div>';
  } else {
    right = '<span class="big">Answer your critique.</span><span class="lede">You do not have to agree with every point. You do have to answer it. Lunch at ' + clockAt(endsAt) + '.</span>' +
      '<div style="position:relative;margin-top:20px;height:320px"><div class="paper" style="transform:rotate(1.5deg)"><i class="h"></i>' +
      '<svg class="write" width="460" height="200" viewBox="0 0 460 200" aria-hidden="true"><path d="M10 30 C 80 10, 140 50, 220 28 S 360 18, 440 30"/><path d="M10 96 C 90 80, 160 112, 240 92 S 340 84, 400 98"/><path d="M10 162 C 70 146, 150 176, 230 158 S 380 150, 440 164"/><path d="M300 190 l 18 0"/></svg>' +
      '<span class="pen"></span></div><span class="bubble" style="left:560px;top:0">What we’re changing…</span><span class="bubble b2" style="left:600px;top:110px">What we’re keeping…</span><span class="bubble b3" style="left:540px;top:220px">One question back</span></div>';
  }
  const label = { sprint: "PLANNING ROUND", critique: "CRITIQUE", response: "RESPONSE" }[kind];
  return '<div class="round">' + ringHTML(600, 30, label) + '<div class="r">' + right + "</div></div>";
}

function sceneHandover() {
  const endsAt = st.clock.endsAt || now();
  const chain = data.chain;
  const chips = chain.map((t, i) => '<span class="t' + (i === chain.length - 1 ? " home" : "") + '">' + esc(t) + "</span>" + (i < chain.length - 1 ? '<span class="a">→</span>' : "")).join("");
  return '<div class="handover"><span class="big" style="font-size:110px">Pens down. Pass it on.</span><div class="chain" id="chain">' + chips + '<span class="sheet" id="sheet"></span></div>' +
    '<span class="lede">Read the plan you’ve been given as if you had to run it tomorrow. The critique opens at ' + clockAt(endsAt) + '.</span><span class="small-clock" id="smallClock"></span></div>';
}

function startHops() {
  clearInterval(hopTimer);
  const chain = $("#chain"), sheet = $("#sheet");
  if (!chain || !sheet) return;
  const chips = [...chain.querySelectorAll(".t")];
  let i = 0;
  const hop = () => {
    chips.forEach((c) => c.classList.remove("lit"));
    const c = chips[i % chips.length];
    c.classList.add("lit");
    const cr = c.getBoundingClientRect(), pr = chain.getBoundingClientRect();
    const k = pr.width / chain.offsetWidth || 1;
    sheet.style.transform = "translate(" + ((cr.left - pr.left) / k + c.offsetWidth / 2 - 27) + "px," + ((cr.top - pr.top) / k - 62) + "px) rotate(" + (i % 2 ? 8 : -8) + "deg)";
    i++;
  };
  hop();
  if (!reduced) hopTimer = setInterval(hop, 1400);
}

function sceneLunch() {
  const after = data.schedule.filter((x) => /present|feedback|recogn|close|certific/i.test(x.what));
  const thanks = st.toggles.partners && data.partners.length ? '<span class="eyebrow" style="margin-top:20px">With thanks to our partners</span><span class="lede" style="color:#F2F6FC">' + data.partners.map(esc).join(" · ") + "</span>" : "";
  return '<div class="arrival"><div class="l"><span class="eyebrow">Lunch</span><span class="big" style="font-size:110px">Enjoy your lunch.</span><span class="lede">The judges are reading every plan, critique and response.</span>' + thanks + "</div>" +
    '<div style="display:flex;flex-direction:column;align-items:center;gap:30px">' +
    '<svg class="bowl" width="300" height="240" viewBox="0 0 300 240" aria-hidden="true"><g class="steam"><path d="M110 90 c -20 -30, 20 -40, 0 -70"/><path d="M150 90 c -20 -30, 20 -40, 0 -70"/><path d="M190 90 c -20 -30, 20 -40, 0 -70"/></g>' +
    '<path d="M40 110 h220 c 0 60 -50 100 -110 100 s -110 -40 -110 -100 z" fill="#EFC22D"/><rect x="20" y="104" width="260" height="12" rx="6" fill="#F2F6FC"/></svg>' +
    (after.length ? '<div class="sched" style="width:560px"><b>This afternoon</b>' + after.map((x, i) => '<div style="animation-delay:' + (0.3 + i * 0.12) + 's"><span>' + esc(x.t) + "</span><span>" + esc(x.what) + "</span></div>").join("") + "</div>" : "") + "</div></div>";
}

function scenePresent() {
  if (!data.onStage) return '<div class="thanks"><span class="eyebrow">Presentations</span><span class="big" style="font-size:110px">Starting shortly.</span><span class="lede">' + data.order.map((o) => esc(o.name) + " " + esc(o.time)).join(" · ") + "</span></div>";
  const ls = data.lastScores;
  const dots = ls ? '<span class="dots">' + Array.from({ length: ls.of }, (_, i) => "<i" + (i < ls.n ? ' class="in"' : "") + "></i>").join("") + "</span>" : "";
  return '<div class="present"><span class="beam b1" aria-hidden="true"></span><span class="beam b2" aria-hidden="true"></span><div class="l" style="position:relative">' +
    '<span class="eyebrow">Now presenting</span><span class="name" id="presName">' + esc(data.onStage) + "</span>" +
    '<span class="lede">' + (data.upNext ? "Up next: " + esc(data.upNext) : "Last presentation") + "</span>" +
    (ls ? '<span class="scores">Judges’ scores for ' + esc(ls.name) + ": " + ls.n + " of " + ls.of + " in " + dots + "</span>" : "") +
    '<svg class="mic" viewBox="0 0 64 120" aria-hidden="true"><rect x="16" y="2" width="32" height="56" rx="16" fill="#F2F6FC" opacity=".85"/><path d="M8 44 v6 a24 24 0 0 0 48 0 v-6" fill="none" stroke="#F2F6FC" stroke-width="5" opacity=".7"/><line x1="32" y1="74" x2="32" y2="110" stroke="#F2F6FC" stroke-width="5" opacity=".7"/></svg>' +
    "</div>" + ringHTML(520, 26, "") + "</div>";
}

function sceneResults() {
  if (!st.revealed || !data.podium) {
    const stars = Array.from({ length: 40 }, (_, i) => '<i style="left:' + ((i * 211) % 1760) + "px;top:" + ((i * 97) % 760) + "px;animation-delay:" + (i % 7) * 0.4 + 's"></i>').join("");
    return '<div class="results"><div class="stars" aria-hidden="true" style="position:absolute;inset:0">' + stars + '</div><span class="eyebrow">Panel feedback</span><span class="big" style="font-size:110px">Feedback and recognitions</span><span class="lede">From the judges’ panel.</span></div>';
  }
  const p = data.podium;
  const order = [p[1], p[0], p[2]].filter(Boolean);
  const h = { First: 380, Second: 310, Third: 260 };
  const colours = ["#EFC22D", "#4FD2C2", "#8FB6E8", "#F2F6FC"];
  const confetti = reduced ? "" : '<div class="confetti" aria-hidden="true">' + Array.from({ length: 70 }, (_, i) =>
    '<i style="left:' + ((i * 53) % 1776) + "px;background:" + colours[i % 4] + ";animation-duration:" + (5 + (i % 5)) + "s;animation-delay:-" + (i % 9) * 0.6 + "s;transform:rotate(" + i * 23 + 'deg)"></i>').join("") + "</div>";
  return '<div class="results">' + confetti + '<span class="big" style="font-size:96px">Recognitions</span><div class="podium">' +
    order.map((x, i) => '<div class="p' + (x.place === "First" ? " first" : "") + '" style="min-height:' + h[x.place] + "px;animation-delay:" + (x.place === "Third" ? 0.2 : x.place === "Second" ? 0.6 : 1.1) + 's"><b>' + x.place.toUpperCase() + "</b><strong>" + esc(x.name) + "</strong><span>Average " + esc(x.avg) + " of 25</span></div>").join("") +
    '</div><span class="lede">Plus the panel’s recognitions.</span></div>';
}

function render() {
  const key = [st.phase, st.flash, data && data.onStage, st.revealed, JSON.stringify(st.toggles), slide, data && data.lastScores && data.lastScores.n, data && data.partners.length].join("|");
  if (key === sceneKey) return;
  sceneKey = key;
  clearInterval(hopTimer);
  let html;
  switch (st.phase) {
    case "arrival": html = sceneArrival(); break;
    case "sprint": case "critique": case "response": html = sceneRound(st.phase); break;
    case "handover": html = sceneHandover(); break;
    case "lunch": html = sceneLunch(); break;
    case "presentations": html = scenePresent(); break;
    default: html = sceneResults();
  }
  $("#scene").innerHTML = '<div class="scene">' + html + "</div>";
  if (st.phase === "handover") requestAnimationFrame(startHops);
  $("#progress").innerHTML = data.phases.map((p, i) => {
    const at = data.phases.findIndex((x) => x.id === st.phase);
    return '<div class="' + (i < at ? "done" : i === at ? "on" : "") + '"><i></i><span>' + esc(p.label.toUpperCase()) + "</span></div>";
  }).join("");
  // Arrival rotates through its slides; the opening animation gets a shorter turn.
  clearTimeout(slideTimer);
  if (st.phase === "arrival" && arrivalSlides().length > 1) {
    const which = arrivalSlides()[slide % arrivalSlides().length];
    slideTimer = setTimeout(() => { slide++; render(); }, DEMO ? (which === "opening" ? 7000 : 6000) : which === "opening" ? 9000 : 15000);
  }
  tick(true);
}

// ---------- every quarter second ----------
function tick(fresh) {
  if (!st) return;
  const rem = remaining();
  const amberAt = st.phase === "presentations" ? 120000 : 300000;
  updateRing(amberAt);
  if (st.phase === "sprint") updateBuilding();
  const sc = $("#smallClock");
  if (sc) sc.textContent = rem === null ? "" : mmss(rem);
  // Sound and banner cues fire when the clock crosses them while running,
  // never on a fresh load in the middle of a round.
  const key = st.phase + ":" + st.flash;
  if (key !== cueKey) { cueKey = key; prevRem = rem; return; }
  if (fresh || rem === null || prevRem === null || paused()) { prevRem = rem; return; }
  const crossed = (mark) => prevRem > mark && rem <= mark;
  const total = st.clock.totalMs;
  if (st.phase === "sprint") {
    if (crossed(total / 2)) { play("chime"); banner("Halfway. If you haven’t named who owns each step, start now."); }
    if (total > 300000 && crossed(300000)) { play("chime"); banner("Five minutes. Finish your sentences, not your ideas."); }
  }
  if (st.phase === "presentations" && crossed(120000)) play("chime");
  if (crossed(0.5)) { play("gong"); flash(); if (st.phase === "sprint") banner("Pens down."); }
  prevRem = rem;
}
setInterval(() => tick(false), 250);

// ---------- following the server ----------
async function poll() {
  try {
    const v = data ? st.version : -1;
    const res = await fetch(API + "/api/stage?k=" + encodeURIComponent(K) + "&v=" + v + "&sound=" + (soundOn ? 1 : 0), { cache: "no-store" });
    const d = await res.json();
    if (!res.ok) { if (!st) document.body.innerHTML = '<div class="err">' + esc(d.error || "This display link is not valid.") + "</div>"; return; }
    offset = d.serverNow - Date.now();
    const testChanged = lastTest !== null && d.testSound !== lastTest;
    lastTest = d.testSound;
    st = { ...d, clock: d.clock };
    if (d.data) data = d.data;
    lastOk = Date.now();
    $("#recon").hidden = true;
    if (testChanged) { play("chime"); showToast(soundOn ? "Test sound" : "Sound is off: click the display"); }
    render();
  } catch {
    if (Date.now() - lastOk > 3000) $("#recon").hidden = false;
  }
}
if (DEMO) runDemo();
else { setInterval(poll, 1000); poll(); }

// ---------- demo mode ----------
function runDemo() {
  const names = ["Foundation", "Blueprint", "Scaffold", "Keystone", "Pillar", "Legacy"];
  const times = ["13:30", "13:42", "13:54", "14:06", "14:18", "14:30"];
  const phases = ["arrival", "sprint", "handover", "critique", "response", "lunch", "presentations", "results"];
  data = {
    phases: phases.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) })),
    schedule: [["8:30", "Arrival, tea and light snacks"], ["10:50", "The sprint opens"], ["11:40", "Plans handed over"], ["11:45", "Critique"], ["12:20", "Response"], ["12:35", "Lunch"], ["13:30", "Presentations"], ["14:50", "Feedback and recognitions"]].map(([t, what]) => ({ t, what })),
    order: names.map((name, i) => ({ name, time: times[i] })),
    chain: names.concat(names[0]),
    partners: ["Sutura Works Limited", "Your partners appear here"],
    onStage: null, upNext: null, lastScores: null, podium: null,
  };
  st = { phase: "arrival", clock: { endsAt: null, pausedMs: null, totalMs: 0 }, toggles: { partners: true, schedule: true, animation: true }, revealed: false, flash: 0, version: 0 };
  // [phase, real seconds on screen, clock minutes or 0, extra]
  const steps = [
    ["arrival", 20, 0], ["sprint", 64, 50], ["handover", 14, 5], ["critique", 32, 35], ["response", 22, 15], ["lunch", 10, 0],
    ["presentations", 16, 10, 0], ["presentations", 16, 10, 1], ["presentations", 16, 10, 2], ["results", 6, 0, "hidden"], ["results", 16, 0, "revealed"],
  ];
  let i = 0;
  const go = () => {
    const [phase, secs, minutes, extra] = steps[i % steps.length];
    const total = minutes * 60000;
    demoTime.v0 = Date.now(); demoTime.r0 = Date.now();
    // Finish the round about two seconds before the step ends, so the gong and flash show.
    demoTime.speed = total ? total / ((secs - 2) * 1000) : 1;
    st.phase = phase; st.flash++; slide = 0;
    st.clock = total ? { endsAt: demoTime.v0 + total, pausedMs: null, totalMs: total } : { endsAt: null, pausedMs: null, totalMs: 0 };
    st.revealed = extra === "revealed";
    if (phase === "presentations") {
      data.onStage = names[extra]; data.upNext = names[extra + 1];
      data.lastScores = extra ? { name: names[extra - 1], n: 4, of: 4 } : null;
    }
    if (phase === "results") data.podium = st.revealed ? [{ place: "First", name: "Keystone", avg: "21.5" }, { place: "Second", name: "Blueprint", avg: "20.0" }, { place: "Third", name: "Legacy", avg: "18.8" }] : null;
    render();
    i++;
    setTimeout(go, secs * 1000);
  };
  document.getElementById("screen").insertAdjacentHTML("beforeend", '<div style="position:absolute;left:72px;top:118px;z-index:4;font-family:var(--mono);font-size:16px;letter-spacing:.12em;color:#0A1F4D;background:#EFC22D;padding:4px 12px;border-radius:6px">DEMO · SAMPLE TABLES · FAST CLOCK</div>');
  go();
}

// ---------- sound, full screen, idle cursor ----------
function showToast(text) {
  const t = $("#toast");
  t.textContent = text; t.classList.remove("hide");
  clearTimeout(showToast.t); showToast.t = setTimeout(() => t.classList.add("hide"), 3500);
}
$("#sound").addEventListener("click", async () => {
  // Browsers allow sound only after a click: prime both sounds silently.
  for (const a of Object.values(audio)) { a.muted = true; try { await a.play(); a.pause(); a.currentTime = 0; } catch { /* ignore */ } a.muted = false; }
  soundOn = true;
  $("#sound").remove();
  showToast("Sound on");
});
$("#fs").addEventListener("click", () => document.documentElement.requestFullscreen?.().catch(() => {}));
document.addEventListener("fullscreenchange", () => document.body.classList.toggle("full", !!document.fullscreenElement));
let idle;
addEventListener("mousemove", () => { document.body.classList.remove("idle"); clearTimeout(idle); idle = setTimeout(() => document.body.classList.add("idle"), 3000); });
