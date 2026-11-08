// The feedback form after QLV 2026. No login: the link is the key, so each
// answer is tied to the person's email on the server. Answers are kept on
// the phone as they are typed, so a dropped connection loses nothing. For a
// sprinter, the certificate download appears once the answers are in.

import { API } from "./config.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const T = new URLSearchParams(location.search).get("t") || "";
const DRAFT = "qlv26-feedback:" + T.slice(0, 12);
const store = {
  get() { try { return JSON.parse(localStorage.getItem(DRAFT)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(DRAFT, JSON.stringify(v)); } catch { /* private mode: keep going in memory */ } },
  clear() { try { localStorage.removeItem(DRAFT); } catch { /* nothing to clear */ } },
};
let a = store.get();
a.socials = a.socials || {};
let info = null;

const OVERALL = [[1, "Poor"], [2, "Fair"], [3, "Good"], [4, "Very good"], [5, "Excellent"]];
const SOCIALS = [["instagram", "Instagram"], ["linkedin", "LinkedIn"], ["x", "X"], ["facebook", "Facebook"], ["tiktok", "TikTok"]];

function choice(name, opts, cls) {
  return '<div class="opts ' + cls + '" role="group" data-q="' + name + '">' + opts.map(([v, label, sub]) =>
    '<button type="button" data-v="' + esc(String(v)) + '" aria-pressed="' + (String(a[name]) === String(v)) + '">' + esc(label) + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</button>").join("") + "</div>";
}
const q = (n, id, title, sub, inner) => '<section class="q" id="q-' + id + '"><span class="n">' + n + "</span><h2>" + title + "</h2>" + (sub ? '<p class="sub">' + sub + "</p>" : "") + inner + "</section>";
const text = (name, placeholder) => '<textarea data-t="' + name + '" maxlength="2000" placeholder="' + esc(placeholder) + '">' + esc(a[name] || "") + "</textarea>";

function form() {
  const staff = info.role !== "participant";
  $("#main").innerHTML =
    '<div class="card"><p style="margin:0">' + (info.first ? "Hello " + esc(info.first) + ". " : "") +
      "Thank you for being part of QLV 2026" + (staff && info.roleLabel ? " as " + esc(info.roleLabel.toLowerCase().replace("check-in desk", "part of the check-in desk")) : "") + ". This takes about three minutes." +
      (info.hasCertificate ? " Your certificate download appears as soon as you send your answers." : "") + "</p></div>" +
    q("1 of 9", "overall", "Overall, how was your QLV 2026 experience?", "", choice("overall", OVERALL.map(([v, l]) => [v, String(v), l]), "o5")) +
    q("2 of 9", "expected", "What did you expect before you came?", "", text("expected", "What you hoped for or thought it would be like")) +
    q("3 of 9", "experienced", "What did you actually experience?", "The moments, people or parts that stood out, good or not so good.", text("experienced", "Tell us how it went for you")) +
    q("4 of 9", "next_time", "What would you like to see next time?", "", text("next_time", "Anything we should add, change or keep")) +
    q("5 of 9", "recommend", "How likely are you to recommend JCI Aso events to a friend or colleague?", "", choice("recommend", Array.from({ length: 11 }, (_, i) => [i, String(i)]), "o11") + '<div class="ends"><span>Not at all likely</span><span>Extremely likely</span></div>') +
    q("6 of 9", "attend_again", "Will you attend another JCI Aso programme?", "", choice("attend_again", [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]], "o3")) +
    q("7 of 9", "membership_info", "Would you like information about JCI Aso membership?", "If yes, we will get back to you with the details.", choice("membership_info", [[true, "Yes, please"], [false, "No, thanks"]], "o2")) +
    q("8 of 9", "event_emails", "Would you like us to email you about JCI Aso events?", "", choice("event_emails", [[true, "Yes, please"], [false, "No, thanks"]], "o2")) +
    q("9 of 9", "socials", "Your social media handles (optional)", "If you would like us to connect with you or tag you. Leave blank to skip.",
      '<div class="soc">' + SOCIALS.map(([k, l]) => '<label for="s-' + k + '">' + l + '</label><input type="text" id="s-' + k + '" data-s="' + k + '" maxlength="100" autocomplete="off" value="' + esc(a.socials[k] || "") + '" placeholder="@yourhandle">').join("") + "</div>") +
    '<div id="err" class="err" hidden style="margin:0 0 12px"></div><button type="button" class="send" id="send">Send my feedback</button>';
}

function done(certificate) {
  store.clear();
  $("#title").textContent = "Thank you";
  $("#main").innerHTML = '<div class="card hold"><div class="lock" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
    "<h2>Thank you" + (info && info.first ? ", " + esc(info.first) : "") + "</h2><p>Your feedback is in. It helps us make the next JCI Aso programme better.</p>" +
    (certificate ? '<a class="dl" href="' + esc(certificate) + '">Download your certificate</a><p class="small" style="margin-top:10px;font-size:13px">You can come back to this link any time to download it again.</p>'
      : info && info.hasCertificate ? "<p style=\"margin-top:10px\">Your certificate will be emailed to you shortly.</p>" : "") + "</div>";
}

const missing = () => {
  if (!a.overall) return ["overall", "Choose how your overall experience was."];
  if (!(a.expected || "").trim()) return ["expected", "Tell us what you expected."];
  if (!(a.experienced || "").trim()) return ["experienced", "Tell us what you experienced."];
  if (!(a.next_time || "").trim()) return ["next_time", "Tell us what you would like next time."];
  if (a.recommend === undefined || a.recommend === null || a.recommend === "") return ["recommend", "Choose how likely you are to recommend JCI Aso events."];
  if (!a.attend_again) return ["attend_again", "Tell us whether you will attend another JCI Aso programme."];
  if (typeof a.membership_info !== "boolean") return ["membership_info", "Tell us whether you would like information about membership."];
  if (typeof a.event_emails !== "boolean") return ["event_emails", "Tell us whether you would like emails about JCI Aso events."];
  return null;
};

document.addEventListener("click", async (e) => {
  const b = e.target.closest(".opts button");
  if (b) {
    const name = b.parentElement.dataset.q, raw = b.dataset.v;
    a[name] = raw === "true" ? true : raw === "false" ? false : ["overall", "recommend"].includes(name) ? Number(raw) : raw;
    for (const x of b.parentElement.children) x.setAttribute("aria-pressed", String(x === b));
    b.closest(".q").classList.remove("miss");
    store.set(a); return;
  }
  if (e.target.id === "send") {
    const m = missing();
    document.querySelectorAll(".q.miss").forEach((x) => x.classList.remove("miss"));
    if (m) { const box = $("#q-" + m[0]); box.classList.add("miss"); box.scrollIntoView({ behavior: "smooth", block: "center" }); $("#err").textContent = m[1]; $("#err").hidden = false; return; }
    const btn = e.target; btn.disabled = true; btn.textContent = "Sending…"; $("#err").hidden = true;
    try {
      const res = await fetch(API + "/api/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ t: T, answers: a }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "That did not go through. Please try again.");
      done(d.certificate);
    } catch (err) {
      $("#err").textContent = (err.message === "Failed to fetch" ? "No connection. Your answers are saved on this phone: try again in a moment." : err.message); $("#err").hidden = false;
      btn.disabled = false; btn.textContent = "Send my feedback";
    }
  }
});
document.addEventListener("input", (e) => {
  const t = e.target.closest("[data-t]"), s = e.target.closest("[data-s]");
  if (t) { a[t.dataset.t] = t.value; t.closest(".q").classList.remove("miss"); store.set(a); }
  if (s) { a.socials[s.dataset.s] = s.value; store.set(a); }
});

(async () => {
  if (!T) { $("#main").innerHTML = '<div class="err">This page needs the link from your QLV 2026 email.</div>'; return; }
  try {
    const res = await fetch(API + "/api/feedback?t=" + encodeURIComponent(T), { cache: "no-store" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "This feedback link is not valid.");
    info = d;
    if (d.submitted) done(d.certificate); else form();
  } catch (err) {
    $("#main").innerHTML = '<div class="err">' + esc(err.message === "Failed to fetch" ? "No connection. Check your internet and refresh this page." : err.message) + "</div>";
  }
})();
