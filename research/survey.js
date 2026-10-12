import { ROLE_SECTION, BRANCHES, BRANCH_FOR_ROLE, CLOSING_SECTION, CONTACT_FIELDS } from "./questions.js";
import { ENDPOINT } from "./config.js";

const STORE_KEY = "sw-research-v1";
const app = document.getElementById("survey");
const progress = document.getElementById("progress");

let state = load() || { step: 0, answers: {}, contact: {}, consent: false, startedAt: Date.now() };

// ---------- storage (best effort: private windows may block it) ----------
function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}
function clearSaved() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignore */ }
}

// ---------- steps ----------
function branch() {
  return BRANCHES[BRANCH_FOR_ROLE[state.answers.role]];
}
function steps() {
  const list = ["intro", ROLE_SECTION];
  if (branch()) list.push(branch());
  list.push(CLOSING_SECTION, "contact");
  return list;
}
function isShown(q) {
  if (!q.showIf) return true;
  const v = state.answers[q.showIf.q];
  return Array.isArray(v) ? v.some((x) => q.showIf.in.includes(x)) : q.showIf.in.includes(v);
}

// ---------- rendering ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function render() {
  const all = steps();
  if (state.step >= all.length) state.step = all.length - 1;
  const current = all[state.step];
  const total = all.length - 1;
  progress.style.width = `${Math.round((state.step / total) * 100)}%`;
  progress.parentElement.setAttribute("aria-valuenow", String(state.step));
  progress.parentElement.setAttribute("aria-valuemax", String(total));

  if (current === "intro") app.innerHTML = introHTML();
  else if (current === "contact") app.innerHTML = contactHTML();
  else app.innerHTML = sectionHTML(current);

  bind(current);
  const h = app.querySelector("h2");
  if (h && state.step > 0) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
}

// Bring the top of the form into view, just below the sticky site header
function toForm() {
  const head = document.querySelector(".site-head");
  const top = app.getBoundingClientRect().top + window.scrollY - (head ? head.offsetHeight : 0) - 16;
  window.scrollTo(0, Math.max(0, top));
}

function introHTML() {
  const resume = Object.keys(state.answers).length > 0;
  return `
    <p class="label">Step 1 of ${steps().length}</p>
    <h2>Before you begin</h2>
    <div class="consent-box">
      <p>By continuing you confirm that you are 18 or older, that you have read the privacy notice above and that you agree to your answers being used for this research.</p>
      <label class="check"><input type="checkbox" id="consent" ${state.consent ? "checked" : ""}> <span>I agree to take part on these terms.</span></label>
      <p class="field-error" id="consent-error" hidden>Please tick the box to continue.</p>
    </div>
    <div class="nav-row">
      <button class="btn btn-primary" data-act="next" type="button">${resume ? "Continue where I left off" : "Start"}</button>
      ${resume ? '<button class="text-btn" data-act="restart" type="button">Start again</button>' : ""}
    </div>`;
}

function questionHTML(q) {
  if (!isShown(q)) return "";
  const v = state.answers[q.id];
  const req = q.required ? '<span class="req" aria-hidden="true">Required</span>' : '<span class="opt">Optional</span>';
  const help = q.help ? `<p class="q-help" id="${q.id}-help">${esc(q.help)}</p>` : "";
  const describedBy = q.help ? `aria-describedby="${q.id}-help"` : "";
  let field = "";
  if (q.type === "short") {
    field = `<input class="q-input" type="text" name="${q.id}" value="${esc(v || "")}" ${describedBy} maxlength="300">`;
  } else if (q.type === "long") {
    field = `<textarea class="q-input" name="${q.id}" rows="5" ${describedBy} maxlength="5000">${esc(v || "")}</textarea>`;
  } else {
    const kind = q.type === "single" ? "radio" : "checkbox";
    field = `<div class="choices">${q.options.map((o) => {
      const on = q.type === "single" ? v === o : Array.isArray(v) && v.includes(o);
      const full = q.max && Array.isArray(v) && v.length >= q.max && !on;
      return `<label class="choice"><input type="${kind}" name="${q.id}" value="${esc(o)}" ${on ? "checked" : ""} ${full ? "disabled" : ""}> <span>${esc(o)}</span></label>`;
    }).join("")}</div>`;
    if (q.other) {
      const picked = q.type === "single" ? v === "Other." : Array.isArray(v) && v.includes("Other.");
      field += `<input class="q-input other-input" type="text" name="${q.id}_other" placeholder="Please specify" value="${esc(state.answers[q.id + "_other"] || "")}" maxlength="300" ${picked ? "" : "hidden"}>`;
    }
  }
  const tag = q.type === "single" || q.type === "multi" ? "fieldset" : "div";
  const legend = tag === "fieldset" ? `<legend class="q-label">${esc(q.label)} ${req}</legend>` : `<label class="q-label" for="f-${q.id}">${esc(q.label)} ${req}</label>`;
  if (tag === "div") field = field.replace(`name="${q.id}"`, `id="f-${q.id}" name="${q.id}"`);
  return `<${tag} class="question" data-q="${q.id}">${legend}${help}${field}<p class="field-error" hidden>This question needs an answer.</p></${tag}>`;
}

function sectionHTML(section) {
  const n = state.step + 1;
  return `
    <p class="label">Step ${n} of ${steps().length}</p>
    <h2>${esc(section.title)}</h2>
    <div class="questions">${section.questions.map(questionHTML).join("")}</div>
    <div class="nav-row">
      <button class="btn btn-secondary" data-act="back" type="button">Back</button>
      <button class="btn btn-primary" data-act="next" type="button">Next</button>
    </div>`;
}

// Email is needed for either option; a name only for an interview
const nameTag = (c) => (c.wants_interview ? '<span class="req">Required</span>' : '<span class="opt">Optional</span>');

function contactHTML() {
  const c = state.contact;
  const any = c.wants_results || c.wants_interview;
  return `
    <p class="label">Step ${steps().length} of ${steps().length}</p>
    <h2>Stay in touch (optional)</h2>
    <p>If you would like a summary of what we find, or you are open to a short follow-up interview, leave your details below. They are stored separately from your answers and used only for these two purposes.</p>
    <fieldset class="question">
      <legend class="q-label">Would you like to:</legend>
      <div class="choices">
        ${CONTACT_FIELDS.map((f) => `<label class="choice"><input type="checkbox" name="${f.id}" ${c[f.id] ? "checked" : ""}> <span>${esc(f.label)}</span></label>`).join("")}
      </div>
    </fieldset>
    <div class="contact-fields" ${any ? "" : "hidden"}>
      <div class="question"><label class="q-label" for="c-name">Your name ${nameTag(c)}</label><input class="q-input" id="c-name" name="name" type="text" autocomplete="name" maxlength="120" value="${esc(c.name || "")}"><p class="field-error" hidden>Please enter your name.</p></div>
      <div class="question"><label class="q-label" for="c-email">Email address <span class="req">Required</span></label><input class="q-input" id="c-email" name="email" type="email" autocomplete="email" maxlength="200" value="${esc(c.email || "")}"><p class="field-error" hidden>Please enter a valid email address.</p></div>
      <div class="question"><label class="q-label" for="c-location">Location <span class="opt">Optional</span></label><p class="q-help">City and state.</p><input class="q-input" id="c-location" name="location" type="text" maxlength="120" value="${esc(c.location || "")}"></div>
    </div>
    <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    <p class="field-error" id="submit-error" hidden></p>
    <div class="nav-row">
      <button class="btn btn-secondary" data-act="back" type="button">Back</button>
      <button class="btn btn-primary" data-act="submit" type="button">Submit my response</button>
    </div>`;
}

// ---------- events ----------
function bind(current) {
  app.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => act(b.dataset.act, current)));

  if (current === "intro") {
    app.querySelector("#consent").addEventListener("change", (e) => { state.consent = e.target.checked; save(); });
    return;
  }
  if (current === "contact") {
    app.querySelectorAll("input").forEach((el) => el.addEventListener("input", () => {
      if (el.type === "checkbox") state.contact[el.name] = el.checked;
      else if (el.name !== "website") state.contact[el.name] = el.value;
      app.querySelector(".contact-fields").hidden = !(state.contact.wants_results || state.contact.wants_interview);
      if (el.type === "checkbox") {
        app.querySelector('label[for="c-name"]').innerHTML = `Your name ${nameTag(state.contact)}`;
        if (!state.contact.wants_interview) app.querySelector("#c-name").parentElement.querySelector(".field-error").hidden = true;
      }
      save();
    }));
    return;
  }
  app.querySelectorAll("input, textarea").forEach((el) => el.addEventListener("input", () => {
    const name = el.name;
    if (el.type === "radio") state.answers[name] = el.value;
    else if (el.type === "checkbox") {
      state.answers[name] = [...app.querySelectorAll(`input[name="${name}"]:checked`)].map((x) => x.value);
      // once the maximum is picked, the rest are disabled until one is unticked
      const q = current.questions.find((x) => x.id === name);
      if (q && q.max) {
        const full = state.answers[name].length >= q.max;
        app.querySelectorAll(`input[name="${name}"]`).forEach((x) => { x.disabled = full && !x.checked; });
      }
    } else state.answers[name] = el.value;
    save();
    if (el.type !== "radio" && el.type !== "checkbox") return;
    // show or hide the "Please specify" box for Other
    const other = app.querySelector(`input[name="${name}_other"]`);
    if (other) {
      const v = state.answers[name];
      other.hidden = !(Array.isArray(v) ? v.includes("Other.") : v === "Other.");
    }
    // re-render only when this answer reveals or hides follow-up questions
    if (current.questions.some((q) => q.showIf && q.showIf.q === name)) {
      const y = window.scrollY;
      render();
      window.scrollTo(0, y);
      const back = app.querySelector(`input[name="${name}"][value="${CSS.escape(el.value)}"]`);
      if (back) back.focus({ preventScroll: true });
    }
  }));
}

function validateSection(section) {
  let firstBad = null;
  for (const q of section.questions) {
    if (!isShown(q)) continue;
    const box = app.querySelector(`[data-q="${q.id}"]`);
    const v = state.answers[q.id];
    let ok = true;
    if (q.required) ok = q.type === "multi" ? Array.isArray(v) && v.length > 0 : Boolean(v && String(v).trim());
    box.querySelector(".field-error").hidden = ok;
    box.classList.toggle("has-error", !ok);
    if (!ok && !firstBad) firstBad = box;
  }
  if (firstBad) firstBad.scrollIntoView({ behavior: "smooth", block: "center" });
  return !firstBad;
}

function validateContact() {
  const c = state.contact;
  if (!(c.wants_results || c.wants_interview)) return true;
  let ok = true;
  const nameBox = app.querySelector("#c-name").parentElement;
  const emailBox = app.querySelector("#c-email").parentElement;
  const nameOk = !c.wants_interview || Boolean(c.name && c.name.trim());
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email || "");
  nameBox.querySelector(".field-error").hidden = nameOk;
  emailBox.querySelector(".field-error").hidden = emailOk;
  if (!nameOk || !emailOk) ok = false;
  return ok;
}

function act(what, current) {
  if (what === "restart") {
    state = { step: 0, answers: {}, contact: {}, consent: false, startedAt: Date.now() };
    save(); render(); return;
  }
  if (what === "back") { state.step = Math.max(0, state.step - 1); save(); render(); toForm(); return; }
  if (what === "next") {
    if (current === "intro") {
      if (!state.consent) { app.querySelector("#consent-error").hidden = false; return; }
    } else if (!validateSection(current)) return;
    state.step += 1; save(); render(); toForm(); return;
  }
  if (what === "submit") submit();
}

// Only send answers to questions the respondent could actually see
function visibleAnswers() {
  const out = {};
  const sections = steps().filter((s) => typeof s === "object");
  for (const s of sections) {
    for (const q of s.questions) {
      if (!isShown(q)) continue;
      const v = state.answers[q.id];
      if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) continue;
      out[q.id] = v;
      const picked = Array.isArray(v) ? v.includes("Other.") : v === "Other.";
      if (q.other && picked && state.answers[q.id + "_other"]) out[q.id + "_other"] = state.answers[q.id + "_other"];
    }
  }
  return out;
}

async function submit() {
  if (!validateContact()) return;
  const btn = app.querySelector('[data-act="submit"]');
  const err = app.querySelector("#submit-error");
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Sending...";
  const c = state.contact;
  const wantsContact = Boolean(c.wants_results || c.wants_interview);
  const payload = {
    consent: state.consent,
    answers: visibleAnswers(),
    contact: wantsContact ? { name: (c.name || "").trim(), email: c.email.trim(), location: (c.location || "").trim(), wants_results: Boolean(c.wants_results), wants_interview: Boolean(c.wants_interview) } : null,
    website: app.querySelector('input[name="website"]').value,
    seconds: Math.round((Date.now() - state.startedAt) / 1000),
  };
  try {
    const res = await fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || `Server responded ${res.status}`);
    clearSaved();
    progress.style.width = "100%";
    app.innerHTML = `
      <p class="label">Response received</p>
      <h2>Thank you.</h2>
      <p class="lead narrow">Your experience will help us understand how to make the Nigerian business journey easier to navigate.</p>
      <p>Your reference number is <strong class="ref">${esc(data.ref)}</strong>. Quote it if you ever want us to correct or delete your response.</p>
      <p><a class="text-link" href="../index.html">Visit Sutura Works</a></p>`;
    toForm();
  } catch (e) {
    btn.disabled = false;
    btn.textContent = "Submit my response";
    err.textContent = "Something went wrong and your response was not sent. Your answers are still saved on this device, so please try again in a moment. If it keeps happening, email socials@suturaworks.com.";
    err.hidden = false;
  }
}

render();
