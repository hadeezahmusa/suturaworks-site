// QLV 2026 registration. Replaces the prototype's fake go() routing and
// submit handlers with real ones. The reference is created on the server
// when someone leaves the details, corporate or sponsored screen, and kept
// in localStorage so a refresh on the transfer screen shows the same one.

import { API, CONTACT, PRIVACY } from "./config.js";
import { QBANK, SITUATIONS, MAX_ANSWER } from "./questions.js";
import { playIntro, playTap, stop as stopSound } from "./sound.js";
import { PRICES, SPONSORED_MIN, SPONSORED_MAX, TIER_NAME, BANK, CLOSES_AT, amountFor, ngn, word, closeLabel } from "./event.js";

const STORE = "qlv26";
const MAX_FILE = 5 * 1024 * 1024;
const FILE_TYPES = { "image/jpeg": 1, "image/png": 1, "application/pdf": 1 };
const NO_BAR = ["landing", "claim", "ticketview"];
const INTRO_SEEN = "qlv26-intro";
const reducedMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const params = new URLSearchParams(location.search);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ---------- state ----------

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch { return {}; }
}
let S = Object.assign({ tier: "standard", pack: 3, seats: SPONSORED_MIN }, load());
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { /* private mode: the server still has it */ }
}
function reset() {
  S = { tier: "standard", pack: 3, seats: SPONSORED_MIN };
  try { localStorage.removeItem(STORE); } catch {}
}

// Context for the questions screen: whose answers, which set, where back goes.
let Q = { key: null, branch: "emp", needsSit: false, back: "pending" };
let proofFile = null;

// The closing date comes from the Worker, so it can be moved from the admin
// page without a code change. The date in event.js is the fallback.
let closeAt = CLOSES_AT;
let closed = false;
function setClosing(at) {
  closeAt = at;
  closed = params.get("closed") === "1" || (params.get("closed") !== "0" && Date.now() >= Date.parse(at));
  bind("closeDate", closeLabel(at));
}

// ---------- helpers ----------

function bind(name, value) {
  $$(`[data-bind="${name}"]`).forEach((el) => { el.textContent = value; });
}
function show(name, on) {
  $$(`[data-show="${name}"]`).forEach((el) => { el.hidden = !on; });
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch(API + path, opts);
  } catch {
    throw new Error("We could not reach the registration server. Check your connection and try again.");
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong on our side. Please try again in a minute.");
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}
function post(path, body) {
  return api(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}

function busy(form, on) {
  $$('button[type="submit"]', form).forEach((b) => {
    if (on) { b.dataset.label = b.textContent; b.textContent = "Sending…"; }
    else if (b.dataset.label) b.textContent = b.dataset.label;
    b.disabled = on;
  });
}
function formError(form, msg) {
  const box = $("[data-err]", form);
  if (!box) return;
  box.hidden = !msg;
  box.textContent = msg || "";
  if (msg) box.scrollIntoView({ block: "center", behavior: "smooth" });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function fieldOk(el) {
  const v = el.value.trim();
  if (el.type === "checkbox") return !el.required || el.checked;
  if (el.required && !v) return false;
  if (v && el.type === "email") return EMAIL_RE.test(v);
  if (v && el.type === "tel") return /^[+0-9 ()-]{7,20}$/.test(v) && v.replace(/\D/g, "").length >= 7;
  return true;
}
// Marks bad fields and returns a message, or "" when the form is fine.
function check(form) {
  let first = null;
  let boxes = 0;
  $$("input, select, textarea", form).forEach((el) => {
    if (el.classList.contains("hp") || el.closest("[hidden]")) return;
    const ok = fieldOk(el);
    const target = el.type === "checkbox" ? el.closest(".note") : el;
    if (target) target.classList.toggle("bad", !ok);
    if (!ok) {
      if (el.type === "checkbox") boxes++;
      first = first || el;
    }
  });
  if (!first) return "";
  first.focus({ preventScroll: true });
  if (boxes && $$(".bad", form).length === boxes) return "Please tick the box above to confirm.";
  return "Please check the highlighted fields. Each one is needed, and emails and phone numbers need to be complete.";
}
function values(form) {
  const out = {};
  $$("input[name], select[name], textarea[name]", form).forEach((el) => {
    out[el.name] = el.type === "checkbox" ? el.checked : el.value.trim();
  });
  return out;
}
function fill(form, data) {
  if (!data) return;
  $$("input[name], select[name]", form).forEach((el) => {
    if (!(el.name in data) || el.classList.contains("hp")) return;
    if (el.type === "checkbox") el.checked = !!data[el.name];
    else el.value = data[el.name];
  });
}

function sitOptions(select, long) {
  select.innerHTML = SITUATIONS.map((s) => `<option value="${s.value}">${long ? s.label : s.short}</option>`).join("");
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- order summary ----------

function size() {
  return S.tier === "corporate" ? S.pack : S.tier === "sponsored" ? S.seats : 1;
}
function amount() {
  // The same rule the server applies, so the two can never disagree.
  return amountFor(S.tier, size());
}
function lineFor() {
  if (S.tier === "standard") return "One seat, both days";
  if (S.tier === "member") return "One member seat, both days";
  if (S.tier === "corporate") return word(S.pack) + " seats, both days";
  return S.seats + " seats at " + ngn(PRICES.sponsoredSeat);
}
function drawSummary() {
  bind("tierName", TIER_NAME[S.tier]);
  bind("line", lineFor());
  bind("amount", ngn(amount()));
}

// ---------- routing ----------

function go(id, push = true) {
  const target = document.getElementById(id);
  if (!target) return;
  if (RENDER[id]) RENDER[id]();
  $$(".screen").forEach((s) => s.classList.remove("on"));
  target.classList.add("on");
  $("#bar").hidden = NO_BAR.includes(id);
  if (push && location.hash !== "#" + id) history.pushState({ id }, "", location.search + "#" + id);
  window.scrollTo(0, 0);
  const h = $("h1", target);
  if (h && push) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

function message(title, body, restart = true) {
  bind("msgTitle", title);
  bind("msgBody", body);
  show("msgRestart", restart);
  go("message", false);
}

// Which screens the back and forward buttons may land on, given what we know.
function allowed(id) {
  if (id === "landing") return !S.proofDone;
  if (["tickets", "membercode", "details", "corporate", "sponsored"].includes(id)) return !closed && !S.proofDone;
  if (id === "adviser") return true;
  if (id === "transfer") return !!S.ref && !S.proofDone;
  if (id === "pending") return !!S.proofDone;
  if (id === "questions" || id === "questionsdone") return !!Q.key;
  return false;
}
window.addEventListener("popstate", () => {
  const id = location.hash.slice(1);
  if (allowed(id)) go(id, false);
});

const RENDER = {
  tickets() {
    $$("[data-tier]").forEach((el) => {
      const on = el.dataset.tier === S.tier;
      el.classList.toggle("sel", on);
      el.setAttribute("aria-checked", on);
    });
    $('[data-action="fromTickets"]').textContent = S.tier === "adviser" ? "Confirm your place" : "Continue to your details";
  },
  landing() {
    // Play the sequence once per session; after that show it at rest.
    let seen = false;
    try { seen = sessionStorage.getItem(INTRO_SEEN) === "1"; sessionStorage.setItem(INTRO_SEEN, "1"); } catch {}
    $("#landing").classList.toggle("rest", seen);
  },
  membercode() {
    const ok = !!S.member;
    $("#codeOk").hidden = !ok;
    $("#m-code").value = ok ? S.member.code : "";
    if (ok) bind("memberName", S.member.name);
    formError($("#f-code"), "");
  },
  details() {
    const member = S.tier === "member";
    $("#memberBox").hidden = !member;
    fill($("#f-details"), S.details);
    // Members: name and code come from the JCI Aso list and cannot be edited here.
    const name = $("#d-name");
    name.readOnly = member;
    name.classList.toggle("locked", member);
    if (member && S.member) {
      name.value = S.member.name;
      $("#d-mcode").value = S.member.code;
    }
    drawSummary();
  },
  corporate() {
    const f = $("#f-corporate");
    fill(f, S.corporate);
    drawPack();
  },
  sponsored() {
    fill($("#f-sponsored"), S.sponsor);
    drawSeatCount();
  },
  transfer() {
    bind("ref", S.ref);
    bind("bankNumber", BANK.number);
    bind("bankName", BANK.name);
    bind("bankBank", BANK.bank);
    drawSummary();
    bind("step4", S.tier === "sponsored" ? "Share your link" : S.tier === "corporate" ? "Tickets issued" : "Ticket issued");
    bind("after2",
      S.tier === "sponsored" ? "Your claim link is emailed to you, usually within one working day." :
      S.tier === "corporate" ? "Each ticket is emailed to the person it is for, usually within one working day." :
      "Your ticket is emailed to you, usually within one working day.");
    const queried = S.status === "queried";
    $("#queriedBox").hidden = !queried;
    if (queried) bind("queryNote", S.queryNote || "The transfer we found did not match the amount or the reference.");
  },
  pending() {
    bind("ref", S.ref);
    bind("email", S.email || "your email");
    drawSummary();
    show("pendSingle", S.tier === "standard" || S.tier === "member");
    show("pendCorporate", S.tier === "corporate");
    show("pendSponsor", S.tier === "sponsored");
    show("pendQuestions", S.tier !== "sponsored");
    bind("pendDay1",
      S.tier === "sponsored" ? "Your claim link arrives by email." :
      S.tier === "corporate" ? "Each ticket arrives by email." : "Your ticket arrives by email.");
    const done = S.status === "confirmed";
    const badge = $('[data-bind="badge"]');
    badge.textContent = done ? (S.tier === "sponsored" ? "Verified" : "Ticket issued") : "Awaiting verification";
    badge.classList.toggle("ok", done);
  },
  questions() { drawQuestions(); },
};

// ---------- tickets screen ----------

function pickTier(tier) {
  S.tier = tier;
  save();
  RENDER.tickets();
}
document.addEventListener("click", (e) => {
  const tier = e.target.closest("[data-tier]");
  if (tier) return pickTier(tier.dataset.tier);
  const pack = e.target.closest("[data-pack]");
  if (pack) return setPack(Number(pack.dataset.pack));
  const step = e.target.closest("[data-seats]");
  if (step) return setSeats(S.seats + Number(step.dataset.seats));
  const g = e.target.closest("[data-go]");
  if (g) return go(g.dataset.go);
  const copy = e.target.closest("[data-copy]");
  if (copy) return copyIt(copy);
  const act = e.target.closest("[data-action]");
  if (act && ACTIONS[act.dataset.action]) ACTIONS[act.dataset.action](act);
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const radio = e.target.closest('[role="radio"]');
  if (!radio) return;
  e.preventDefault();
  radio.click();
});

const ACTIONS = {
  // Changing ticket type after a reference exists keeps the same reference;
  // the server updates the tier and amount until proof is uploaded.
  fromTickets() {
    if (S.tier === "adviser") return go("adviser");
    if (S.tier === "member") return go(S.member ? "details" : "membercode");
    go(S.tier === "corporate" ? "corporate" : S.tier === "sponsored" ? "sponsored" : "details");
  },
  backFromTransfer() {
    go(S.tier === "corporate" ? "corporate" : S.tier === "sponsored" ? "sponsored" : "details");
  },
  backFromDetails() { go(S.tier === "member" ? "membercode" : "tickets"); },
  // Landing
  startRegistration() {
    playTap();
    go(closed ? "closed" : "tickets");
  },
  landingReplay() {
    const seq = $("#lpSeq");
    const fresh = seq.cloneNode(true);
    seq.replaceWith(fresh);
    $("#landing").classList.remove("rest");
    if ($("#lpSound").getAttribute("aria-pressed") === "true") playIntro({ reduced: reducedMotion });
  },
  landingSound(btn) {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", on);
    btn.querySelector("span").textContent = on ? "Sound on" : "Sound";
    if (on) ACTIONS.landingReplay();
    else stopSound();
  },
  // Member code
  notMe() {
    delete S.member;
    delete S.memberCheck;
    save();
    RENDER.membercode();
    formError($("#f-code"), "Check the code against the message JCI Aso sent you and try again. If the name shown is still wrong, ask JCI Aso to check it.");
    $("#m-code").focus();
  },
  memberConfirm() {
    if (!S.memberCheck) return;
    S.member = S.memberCheck;
    delete S.memberCheck;
    save();
    go("details");
  },
  backFromAdviser() { go(closed ? "closed" : "tickets"); },
  restart() {
    reset();
    history.replaceState(null, "", location.pathname);
    go(closed ? "closed" : "tickets", false);
  },
  questionsFromPending() {
    const single = S.tier === "standard" || S.tier === "member";
    openQuestions({ key: S.key, branch: single ? S.details && S.details.situation : null, back: "pending" });
  },
  questionsFromAdviser() {
    openQuestions({ key: S.adviserKey, branch: null, back: "adviserdone" });
  },
  questionsFromTicket() {
    openQuestions({ key: Q.ticketKey, branch: Q.ticketBranch, back: "ticketview" });
  },
  questionsBack() {
    if (Q.back === "claimed") {
      message("Your seat is claimed", `Ticket ${Q.claimRef} is on its way to ${Q.claimEmail}. If it is not in your inbox in a few minutes, check your junk or spam folder. You can answer the three questions any time before ${closeLabel(closeAt)} from the link in that email.`, false);
    } else go(Q.back || "tickets");
  },
  questionsAgain() { go("questions"); },
  refreshSponsor() { openSponsor(Q.manage, true); },
};

function copyIt(btn) {
  const which = btn.dataset.copy;
  const v = which === "ref" ? S.ref : which === "bankNumber" ? BANK.number : $("#" + which).value;
  const old = btn.textContent;
  const done = () => { btn.textContent = "Copied"; setTimeout(() => { btn.textContent = old; }, 1400); };
  if (navigator.clipboard) navigator.clipboard.writeText(v).then(done, () => fallbackCopy(v, done));
  else fallbackCopy(v, done);
}
function fallbackCopy(v, done) {
  const t = document.createElement("textarea");
  t.value = v;
  t.style.position = "fixed";
  t.style.opacity = "0";
  document.body.appendChild(t);
  t.select();
  try { document.execCommand("copy"); done(); } catch {}
  t.remove();
}

// ---------- corporate ----------

const SEAT_NAMES = ["Seat one", "Seat two", "Seat three", "Seat four", "Seat five"];

function readSeats() {
  const rows = $$("#seatList .seat");
  if (!rows.length) return (S.corporate && S.corporate.attendees) || [];
  return rows.map((row) => ({
    name: $('[data-k="name"]', row).value.trim(),
    email: $('[data-k="email"]', row).value.trim(),
    role: $('[data-k="role"]', row).value.trim(),
    situation: $('[data-k="situation"]', row).value,
    judge: row.dataset.judge === "1",
  }));
}
function seatRow(i, a, judge) {
  const title = judge ? "Judge or mentor" : SEAT_NAMES[i];
  const chip = judge ? '<span class="chip gold">Free with this pack</span>' : '<span class="chip pill">Paid seat</span>';
  const style = judge ? ' style="border-color:var(--yel);background:#FFFDF4"' : "";
  const id = judge ? "j" : String(i);
  return `<div class="seat"${style} data-judge="${judge ? 1 : 0}"><div class="hd"><b style="font-size:12px;color:var(--navy)">${title}</b>${chip}</div>
    <div class="grid3">
      <input type="text" data-k="name" aria-label="${title}, full name" placeholder="Full name" maxlength="120" required value="${esc(a.name || "")}">
      <input type="email" data-k="email" aria-label="${title}, email" placeholder="Email" maxlength="160" required value="${esc(a.email || "")}">
      <input type="text" data-k="role" aria-label="${title}, role" placeholder="Role" maxlength="120" value="${esc(a.role || "")}">
    </div>
    <select data-k="situation" id="sit-${id}" aria-label="${title}, which is closest to their situation"></select>
  </div>`;
}
function drawSeats() {
  const prev = readSeats();
  const paid = prev.filter((a) => !a.judge);
  const judge = prev.find((a) => a.judge) || {};
  let html = "";
  for (let i = 0; i < S.pack; i++) html += seatRow(i, paid[i] || {}, false);
  html += seatRow(0, judge, true);
  const list = $("#seatList");
  list.innerHTML = html;
  $$("select", list).forEach((sel, i) => {
    sitOptions(sel, false);
    const src = i < S.pack ? paid[i] : judge;
    if (src && src.situation) sel.value = src.situation;
  });
}
function drawPack() {
  $("#p3").classList.toggle("sel", S.pack === 3);
  $("#p5").classList.toggle("sel", S.pack === 5);
  $("#p3").setAttribute("aria-checked", S.pack === 3);
  $("#p5").setAttribute("aria-checked", S.pack === 5);
  drawSummary();
  bind("seatCount", word(S.pack) + " paid seats and your judge or mentor");
  bind("coNote", word(S.pack + 1) + " tickets issue to the emails above once the transfer is verified.");
  drawSeats();
}
function setPack(n) {
  if (S.corporate) S.corporate.attendees = readSeats();
  else S.corporate = { attendees: readSeats() };
  S.pack = n;
  save();
  drawPack();
}

// ---------- sponsored ----------

function setSeats(n) {
  S.seats = Math.min(SPONSORED_MAX, Math.max(SPONSORED_MIN, n));
  save();
  drawSeatCount();
}
function drawSeatCount() {
  $("#qty").value = S.seats;
  drawSummary();
}

// ---------- registering ----------

async function register(form, payload) {
  formError(form, "");
  busy(form, true);
  try {
    if (S.ref && S.key) Object.assign(payload, { ref: S.ref, key: S.key });
    const r = await post("/api/register", payload);
    Object.assign(S, { ref: r.ref, key: r.key, amount: r.amount, email: r.email, status: r.status, proofDone: false });
    save();
    go("transfer");
  } catch (err) {
    if (err.code === "locked") {
      // Proof already sent for this reference: show where they are instead.
      S.proofDone = true;
      save();
      go("pending");
    } else if (err.code === "unknown_ref") {
      delete S.ref; delete S.key;
      save();
      formError(form, "Your earlier registration could not be found. Press the button again to start a fresh one.");
    } else formError(form, err.message);
  } finally {
    busy(form, false);
  }
}

$("#f-code").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const code = $("#m-code").value.replace(/\s+/g, "").toUpperCase();
  $("#codeOk").hidden = true;
  if (!code) return formError(f, "Please type the code JCI Aso sent you.");
  formError(f, "");
  busy(f, true);
  try {
    const body = { code };
    if (S.ref && S.key) Object.assign(body, { ref: S.ref, key: S.key });
    const r = await post("/api/member-check", body);
    S.memberCheck = { code: r.code, name: r.name };
    bind("memberName", r.name);
    $("#codeOk").hidden = false;
    $('[data-action="memberConfirm"]').focus();
  } catch (err) {
    formError(f, err.message);
  } finally {
    busy(f, false);
  }
});

$("#f-details").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const msg = check(f);
  if (msg) return formError(f, msg);
  const v = values(f);
  S.details = v;
  save();
  const extra = S.tier === "member" && S.member ? { memberCode: S.member.code, name: S.member.name } : {};
  register(f, { tier: S.tier, ...v, ...extra });
});

$("#f-corporate").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const msg = check(f);
  if (msg) return formError(f, msg);
  const v = values(f);
  const attendees = readSeats();
  const emails = attendees.map((a) => a.email.toLowerCase());
  if (new Set(emails).size !== emails.length) {
    return formError(f, "Each person needs their own email address, because each ticket is sent to the person it is for.");
  }
  S.corporate = { organisation: v.organisation, email: v.email, attendees };
  save();
  register(f, { tier: "corporate", pack: S.pack, organisation: v.organisation, email: v.email, attendees, website: v.website });
});

$("#f-sponsored").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const msg = check(f);
  if (msg) return formError(f, msg);
  const v = values(f);
  S.sponsor = v;
  save();
  register(f, { tier: "sponsored", seats: S.seats, ...v });
});

// ---------- proof upload ----------

function fileProblem(file) {
  const okType = FILE_TYPES[file.type] || /\.(jpe?g|png|pdf)$/i.test(file.name);
  if (!okType) return "That file type will not work. Please upload a JPG, PNG or PDF.";
  if (file.size > MAX_FILE) return "That file is over 5MB. A screenshot is usually much smaller, or try the PDF receipt from your bank.";
  if (file.size === 0) return "That file is empty. Please choose it again.";
  return "";
}
function setFile(file) {
  const f = $("#f-proof");
  const problem = fileProblem(file);
  if (problem) {
    proofFile = null;
    $("#drop").classList.remove("has");
    $("#fname").hidden = true;
    return formError(f, problem);
  }
  formError(f, "");
  proofFile = file;
  $("#drop").classList.add("has");
  $("#fname").hidden = false;
  $("#fname").textContent = file.name;
  $("#pickFile").textContent = "Choose a different file";
}
$("#pickFile").addEventListener("click", () => $("#proofFile").click());
$("#proofFile").addEventListener("change", (e) => { if (e.target.files[0]) setFile(e.target.files[0]); });
const drop = $("#drop");
["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => {
  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length > 1) return formError($("#f-proof"), "Please upload one file only.");
  if (files && files[0]) setFile(files[0]);
});

$("#f-proof").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  if (!proofFile) return formError(f, "Please choose your screenshot or receipt first.");
  const msg = check(f);
  if (msg) return formError(f, msg);
  formError(f, "");
  busy(f, true);
  try {
    const type = FILE_TYPES[proofFile.type] ? proofFile.type
      : /\.pdf$/i.test(proofFile.name) ? "application/pdf" : /\.png$/i.test(proofFile.name) ? "image/png" : "image/jpeg";
    const r = await api("/api/proof", {
      method: "POST",
      headers: { "content-type": type, "x-ref": S.ref, "x-key": S.key },
      body: proofFile,
    });
    Object.assign(S, { proofDone: true, status: r.status });
    save();
    proofFile = null;
    go("pending");
  } catch (err) {
    formError(f, err.message);
  } finally {
    busy(f, false);
  }
});

// ---------- the three questions ----------

function openQuestions(ctx) {
  Q = Object.assign(Q, ctx, { needsSit: !ctx.branch, branch: ctx.branch || Q.branch || "emp" });
  $("#claimedBox").hidden = ctx.back !== "claimed";
  go("questions");
}
function drawQuestions() {
  $("#qSitBox").hidden = !Q.needsSit;
  if (Q.needsSit) $("#q-sit").value = Q.branch;
  const set = QBANK[Q.branch] || QBANK.emp;
  bind("qTitle", set.title);
  const n = String(set.q.length).padStart(2, "0");
  $("#qList").innerHTML = set.q.map((item, i) => `<div class="q">
      <div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap">
        <span class="n">${String(i + 1).padStart(2, "0")} of ${n}</span>
        ${item.opt ? '<span class="opt">Leave blank if it has not happened</span>' : ""}
      </div>
      <label class="t" for="ans${i}">${esc(item.t)}</label>
      <span class="fine" id="ans${i}h">${esc(item.h)}</span>
      <textarea id="ans${i}" aria-describedby="ans${i}h" maxlength="${MAX_ANSWER}" placeholder="Type your answer"${item.opt ? "" : " required"}></textarea>
    </div>`).join('<div class="hr"></div>');
  formError($("#f-questions"), "");
}
$("#q-sit").addEventListener("change", (e) => { Q.branch = e.target.value; drawQuestions(); });

$("#f-questions").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const answers = $$("#qList textarea").map((t) => t.value.trim());
  const set = QBANK[Q.branch];
  const missing = set.q.findIndex((item, i) => !item.opt && !answers[i]);
  $$("#qList textarea").forEach((t, i) => t.classList.toggle("bad", !set.q[i].opt && !answers[i]));
  if (missing >= 0) {
    $("#ans" + missing).focus();
    return formError(f, "Please answer the first two. The third can stay blank if it has not happened to you.");
  }
  busy(f, true);
  formError(f, "");
  try {
    await post("/api/answers", { key: Q.key, branch: Q.branch, answers });
    go("questionsdone");
  } catch (err) {
    formError(f, err.message);
  } finally {
    busy(f, false);
  }
});

// ---------- adviser ----------

const MODE = {
  both: { role: "Adviser and judge", as: "an adviser and judge" },
  judge: { role: "Judge", as: "a judge" },
  adviser: { role: "Adviser", as: "an adviser" },
};

$("#f-adviser").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const msg = check(f);
  if (msg) return formError(f, msg);
  formError(f, "");
  busy(f, true);
  const v = values(f);
  try {
    const r = await post("/api/adviser", v);
    S.adviserKey = r.key;
    save();
    bind("ref", r.ref);
    const m = MODE[v.mode] || MODE.both;
    bind("advRole", m.role);
    bind("advLede", `Thank you. Your place as ${m.as} is held, and a calendar invitation is on its way to your email.`);
    show("advQuestions", true);
    go("adviserdone");
  } catch (err) {
    formError(f, err.message);
  } finally {
    busy(f, false);
  }
});

// ---------- sponsored claim ----------

let claimToken = null;

async function openClaim(token) {
  claimToken = token;
  try {
    const r = await api("/api/claim?t=" + encodeURIComponent(token));
    if (r.state === "full") return message("All the seats on this link have been claimed", "Every seat your sponsor paid for now has a name on it. If you were expecting one, ask the person who sent you the link.", false);
    if (r.state === "closed") return message("This claim link has closed", `Seats that were not claimed by ${closeLabel(closeAt)} have been released. If you were expecting one, ask the person who sent you the link.`, false);
    if (r.state !== "open") return message("This link is not ready yet", "Your sponsor's transfer is still being checked. Try the link again later today.", false);
    go("claim", false);
  } catch (err) {
    if (err.status === 404) return message("This link has not worked", "Check that you copied the whole link from the message your sponsor sent.", false);
    message("We could not load your seat", err.message, false);
  }
}
$("#f-claim").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const msg = check(f);
  if (msg) return formError(f, msg);
  formError(f, "");
  busy(f, true);
  const v = values(f);
  try {
    const r = await post("/api/claim", { t: claimToken, ...v });
    bind("claimRef", r.ref);
    bind("claimEmail", r.email);
    Q.claimRef = r.ref;
    Q.claimEmail = r.email;
    openQuestions({ key: r.key, branch: v.situation, back: "claimed" });
  } catch (err) {
    if (err.code === "full") message("All the seats on this link have been claimed", "Somebody took the last seat a moment before you. Ask the person who sent you the link.", false);
    else formError(f, err.message);
  } finally {
    busy(f, false);
  }
});

// ---------- sponsor tracker ----------

async function openSponsor(manage, refresh) {
  Q.manage = manage;
  try {
    const r = await api("/api/sponsor?m=" + encodeURIComponent(manage));
    if (!r.claimUrl) return message("Your transfer is still being checked", `Your claim link for ${r.ref} arrives by email as soon as the transfer clears, usually within one working day.`, false);
    const total = r.seats;
    const taken = r.claims.length;
    bind("spTitle", `Transfer verified, ${word(total).toLowerCase()} seats held`);
    bind("spCount", `${word(taken)} of ${word(total).toLowerCase()} seats claimed`);
    $("#claimUrl").value = r.claimUrl;
    $("#spPips").innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < taken ? "on" : ""}"></i>`).join("");
    let rows = r.claims.map((c) => `<div class="claimrow"><div><b style="font-size:13px">Claimed</b><div class="fine">Ticket ${esc(c.ref)} issued</div></div><span class="chip" style="background:#E2F2F2;color:#19646D">Claimed</span></div>`).join("");
    const open = r.closed ? `Released on ${closeLabel(closeAt)}` : "Nobody has used the link for this one yet";
    for (let i = taken; i < total; i++) rows += `<div class="claimrow"><div><b style="font-size:13px;color:var(--mute)">Open seat</b><div class="fine">${open}</div></div><span class="chip pill">${r.closed ? "Released" : "Open"}</span></div>`;
    $("#claimRows").innerHTML = rows;
    go("sponsorlink", false);
  } catch (err) {
    if (err.status === 404) return message("This link has not worked", "Check that you copied the whole link from your email.", false);
    if (!refresh) message("We could not load your seats", err.message, false);
  }
}

// ---------- ticket view ----------

const TICKET = {
  standard: { chip: "Standard", bg: "#1F7D87", fg: "#fff" },
  member: { chip: "JCI Aso member", bg: "#EFC22D", fg: "#0F2B63" },
  corporate: { chip: "Corporate seat", bg: "#184E9E", fg: "#fff" },
  judge: { chip: "Judge or mentor", bg: "#184E9E", fg: "#fff" },
  sponsored: { chip: "Sponsored seat", bg: "#16537A", fg: "#fff" },
  adviser: { chip: "Adviser", bg: "transparent", fg: "#0F2B63", border: "1.5px solid #0F2B63" },
};

async function openTicket(token) {
  try {
    const t = await api("/api/ticket?t=" + encodeURIComponent(token));
    const style = TICKET[t.kind] || TICKET.standard;
    const chip = $("#tkChip");
    chip.textContent = style.chip;
    chip.style.background = style.bg;
    chip.style.color = style.fg;
    chip.style.border = style.border || "none";
    bind("tkName", t.name);
    bind("tkRef", t.ref);
    const adviser = t.kind === "adviser";
    show("tkD1", !adviser);
    bind("tkD2Time", adviser ? "Saturday 7 November, 10:15am to about 3:00pm" : "Saturday 7 November, 8:30am to 4:00pm");
    bind("tkD2Note", adviser ? "Transcorp Hilton, Abuja. Collect your badge and roving route at the desk. Lunch included."
      : "Transcorp Hilton, Abuja. Lunch included. Your task is given out as the sprint opens.");
    if (adviser || t.kind === "judge") {
      bind("tkSideLbl", "Role");
      bind("tkSide", adviser ? (MODE[t.mode] || MODE.both).role : "Judge or mentor, not in a team");
    } else {
      bind("tkSideLbl", "Team");
      bind("tkSide", "Announced on day one");
    }
    bind("tkPaid", t.paidLine);
    bind("tkVer", (t.kind === "sponsored" ? "CLAIMED " : adviser ? "CONFIRMED " : "VERIFIED ") + t.ref);
    Q.ticketKey = token;
    Q.ticketBranch = t.situation || null;
    show("tkQuestions", !closed);
    document.title = `${t.ref} | QLV 2026 ticket`;
    go("ticketview", false);
  } catch (err) {
    if (err.status === 404) return message("This ticket link has not worked", "Check that you opened the whole link from your ticket email.", false);
    message("We could not load your ticket", err.message, false);
  }
}

// ---------- answers from an email link ----------

async function openAnswerLink(key) {
  try {
    const r = await api("/api/answer-context?k=" + encodeURIComponent(key));
    if (r.closed) return message("Answers have closed", "The six sprint tasks have been drawn from the answers already sent. Thank you for thinking of it.", false);
    openQuestions({ key, branch: r.branch || null, back: null });
    show("msgRestart", false);
  } catch (err) {
    message("This link has not worked", err.status === 404 ? "Check that you opened the whole link from your email." : err.message, false);
  }
}

// ---------- resuming a registration ----------

async function resume(ref, key) {
  try {
    const r = await api(`/api/status?ref=${encodeURIComponent(ref)}&k=${encodeURIComponent(key)}`);
    Object.assign(S, {
      ref: r.ref, key, tier: r.tier, amount: r.amount, email: r.email, status: r.status,
      queryNote: r.queryNote, proofDone: r.proof && r.status !== "queried",
    });
    if (r.tier === "corporate") S.pack = r.size;
    if (r.tier === "sponsored") S.seats = r.size;
    if (r.situation) S.details = Object.assign(S.details || {}, { situation: r.situation });
    save();
    if (r.status === "released") {
      reset();
      return message("This registration has been released", `We did not receive a transfer for ${r.ref}, so the seat was released. If you did pay, email ${CONTACT} with your proof and we will put it right.`);
    }
    if (r.status === "confirmed" && r.tier === "sponsored" && r.manage) return openSponsor(r.manage);
    go(S.proofDone ? "pending" : "transfer", false);
  } catch (err) {
    if (err.status === 404) {
      reset();
      return go(closed ? "closed" : "tickets", false);
    }
    // Offline or server trouble: show what we have locally so the reference is never lost.
    go(S.proofDone ? "pending" : "transfer", false);
  }
}

// ---------- start ----------

async function loadClosing() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(API + "/api/config", { signal: ctl.signal }).then((x) => x.json());
    clearTimeout(timer);
    if (r.closesAt) return setClosing(r.closesAt);
  } catch { /* fall back to the date in event.js */ }
  setClosing(CLOSES_AT);
}

async function init() {
  await loadClosing();
  $$(".js-sit").forEach((sel) => sitOptions(sel, sel.dataset.long === "1"));
  $$(".js-privacy").forEach((p) => { p.textContent = PRIVACY; });
  $$(".js-contact").forEach((a) => { a.href = "mailto:" + CONTACT; if (a.textContent.includes("@")) a.textContent = CONTACT; });
  if (S.details && S.details.situation) $("#d-sit").value = S.details.situation;

  if (params.get("claim")) return openClaim(params.get("claim"));
  if (params.get("sponsor")) return openSponsor(params.get("sponsor"));
  if (params.get("ticket")) return openTicket(params.get("ticket"));
  if (params.get("answer")) return openAnswerLink(params.get("answer"));
  if (params.get("ref") && params.get("k")) {
    const ref = params.get("ref"), k = params.get("k");
    history.replaceState(null, "", location.pathname);
    if (S.ref !== ref) reset();
    return resume(ref, k);
  }
  if (S.ref && S.key) return resume(S.ref, S.key);
  const want = location.hash.slice(1);
  if (want === "adviser") return go("adviser", false);
  if (closed) return go("closed", false);
  go(want && allowed(want) ? want : "landing", false);
}

init();
