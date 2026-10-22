// The brief behind each person's link. Before the unlock time it shows only
// a holding page; the server sends nothing else until then. The documents
// arrive already rendered from the templates and escaped by the server.

import { API } from "./config.js";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const params = new URLSearchParams(location.search);

function fail(text) {
  $("#main").innerHTML = '<div class="err">' + esc(text) + "</div>";
}

async function load() {
  const q = params.get("p") ? "p=" + encodeURIComponent(params.get("p")) : "k=" + encodeURIComponent(params.get("k") || "");
  let d;
  try {
    const res = await fetch(API + "/api/brief?" + q);
    d = await res.json();
    if (!res.ok) return fail(d.error || "This link could not be opened.");
  } catch {
    return fail("We could not reach the server. Check your connection and refresh the page.");
  }
  $("#ref").textContent = d.ref;
  $("#fref").textContent = d.ref;
  $("#title").textContent = d.name;
  if (d.preview) $("#pv").hidden = false;
  if (d.locked) {
    $("#main").innerHTML = '<div class="card hold"><span class="lock"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>' +
      "<h2>Your brief opens at " + esc(d.unlockLabel) + ".</h2>" +
      "<p>The sprint tasks stay sealed until the morning of the day, for everyone. Keep this link and open it again then.</p></div>";
    return;
  }
  if (d.empty || !d.docs.length) return fail("Your brief is not ready yet. Please speak to the chairperson.");
  const tabs = $("#tabs");
  tabs.innerHTML = d.docs.length > 1 ? d.docs.map((doc, i) => '<button type="button" data-doc="' + i + '" aria-pressed="' + (i === 0) + '">' + esc(doc.role + " · " + doc.title) + "</button>").join("") : "";
  const show = (i) => {
    $("#main").innerHTML = '<article class="card doc">' + d.docs[i].html + "</article>";
    tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.doc) === i)));
    scrollTo(0, 0);
  };
  tabs.addEventListener("click", (e) => { const b = e.target.closest("[data-doc]"); if (b) show(Number(b.dataset.doc)); });
  show(0);
}
load();
