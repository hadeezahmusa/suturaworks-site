// The Feedback tab: who has answered, the numbers, the people who asked
// about membership or event emails, each answer in full, and the CSV.
// Admin only: answers are tied to names and emails.

export const FEEDBACK_STYLE = String.raw`
#feedbackView .grey td{color:var(--mute)}
#feedbackView .nums{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 6px}
#feedbackView .nums div{flex:1 1 120px;border:1px solid var(--line);border-radius:8px;padding:10px 12px}
#feedbackView .nums b{display:block;font-family:Poppins,sans-serif;font-size:22px;color:var(--navy)}
#feedbackView .nums span{font-size:12px;color:var(--mute)}
#feedbackView .ans{background:#F7F9FC;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:6px 0 0;font-size:13px}
#feedbackView .ans p{margin:0 0 6px;white-space:pre-wrap}
#feedbackView .ans b{color:var(--navy)}
#feedbackView .chips button{margin:0 6px 6px 0}
`;

export const FEEDBACK_HTML = String.raw`<div id="feedbackView" hidden><div id="fbBox"></div></div>`;

export const FEEDBACK_JS = String.raw`
let fbData = null, fbFilter = "all", fbOpen = null;
const FB_STATUS = (p) => p.submittedAt ? '<span class="st confirmed">Answered ' + esc(when(p.submittedAt)) + "</span>"
  : p.openedAt ? '<span class="st queried">Opened, not answered</span>'
  : p.emailedAt ? '<span class="st awaiting">Emailed ' + esc(when(p.emailedAt)) + "</span>"
  : '<span class="small">' + (p.via === "certificate" ? "Goes with the certificate" : p.via === "thanks" ? "Goes with the thank-you" : "Not emailed yet") + "</span>";
const FB_OVERALL = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
const FB_ATTEND = { yes: "Yes", maybe: "Maybe", no: "No" };

async function loadFeedback() {
  const d = fbData = await call("feedback");
  const s = d.summary, box = $("#fbBox");
  const filters = { all: "Everyone", answered: "Answered", waiting: "Not answered", membership: "Want membership info", emails: "Want event emails" };
  const show = d.people.filter((p) => fbFilter === "all" ? true : fbFilter === "answered" ? !!p.answers : fbFilter === "waiting" ? !p.answers
    : fbFilter === "membership" ? p.answers && p.answers.membership_info : p.answers && p.answers.event_emails);
  const count = (k) => d.people.filter((p) => k === "all" ? true : k === "answered" ? !!p.answers : k === "waiting" ? !p.answers : k === "membership" ? p.answers && p.answers.membership_info : p.answers && p.answers.event_emails).length;
  const socials = (o) => Object.entries(o || {}).map(([k, v]) => ({ instagram: "Instagram", linkedin: "LinkedIn", x: "X", facebook: "Facebook", tiktok: "TikTok" }[k] + ": " + esc(v))).join(" · ");
  const answers = (a) => '<div class="ans">' +
    "<p><b>Overall:</b> " + a.overall + " of 5, " + FB_OVERALL[a.overall] + " · <b>Recommend:</b> " + a.recommend + " of 10 · <b>Attend again:</b> " + FB_ATTEND[a.attend_again] + "</p>" +
    "<p><b>What they expected:</b> " + esc(a.expected) + "</p><p><b>What they experienced:</b> " + esc(a.experienced) + "</p><p><b>Next time:</b> " + esc(a.next_time) + "</p>" +
    "<p><b>Membership information:</b> " + (a.membership_info ? "Yes" : "No") + " · <b>Event emails:</b> " + (a.event_emails ? "Yes" : "No") + "</p>" +
    (socials(a.socials) ? "<p><b>Social media:</b> " + socials(a.socials) + "</p>" : "") + "</div>";
  const row = (p) => '<tr class="' + (p.answers ? "" : "") + '"><td>' + (p.answers ? "" : '<input type="checkbox" data-fbtick="' + esc(p.key) + '"' + (p.via === "own" && !p.emailedAt ? " checked" : "") + ' style="width:18px;height:18px">') + "</td>" +
    "<td><b>" + esc(p.name) + '</b><div class="small">' + esc(p.roleLabel) + (p.group ? " · " + esc(p.group) : "") + '</div>' + (fbOpen === p.key && p.answers ? answers(p.answers) : "") + "</td>" +
    '<td class="small hide-s">' + esc(p.email || "") + "</td><td>" + FB_STATUS(p) + '</td><td class="small" style="white-space:nowrap">' +
    (p.answers ? '<button class="link" data-fbview="' + esc(p.key) + '">' + (fbOpen === p.key ? "Hide answers" : "Answers") + "</button>" : '<button class="link" data-fbcopy="' + esc(p.key) + '">Copy link</button>') + "</td></tr>";
  box.innerHTML =
    '<div class="card"><h2>Feedback</h2><p class="small" style="margin:-4px 0 10px">Each person answers on their own link, so every answer is tied to their email. Sprinters get the link in their certificate email and download the certificate after answering. Judges, mentors, the marshal and the desk get it in their thank-you. Facilitators get it on its own: tick them below and send.</p>' +
      '<div class="nums"><div><b>' + s.submitted + " of " + s.people + "</b><span>Answered</span></div>" +
      "<div><b>" + (s.overall || "-") + "</b><span>Overall, out of 5</span></div>" +
      "<div><b>" + (s.recommend || "-") + "</b><span>Would recommend, out of 10</span></div>" +
      "<div><b>" + (s.nps === null ? "-" : (s.nps > 0 ? "+" : "") + s.nps) + "</b><span>Net Promoter Score</span></div>" +
      "<div><b>" + s.attend.yes + " / " + s.attend.maybe + " / " + s.attend.no + "</b><span>Attend again: yes / maybe / no</span></div>" +
      "<div><b>" + s.membership + "</b><span>Want membership info</span></div>" +
      "<div><b>" + s.eventEmails + "</b><span>Want event emails</span></div>" +
      "<div><b>" + s.socials + "</b><span>Shared social handles</span></div></div>" +
      '<div class="actions"><a class="btn ghost" href="/admin/export/feedback.csv">Download all answers (CSV)</a></div></div>' +
    '<div class="card" style="margin-top:14px;padding:0;overflow-x:auto"><div style="padding:14px 16px 4px"><div class="chips">' +
      Object.keys(filters).map((k) => '<button class="' + (k === fbFilter ? "on" : "") + '" data-fbf="' + k + '">' + filters[k] + " (" + count(k) + ")</button>").join("") + "</div></div>" +
      "<table><thead><tr><th></th><th>Name</th><th class=\"hide-s\">Email</th><th>Status</th><th></th></tr></thead><tbody>" +
      (show.map(row).join("") || '<tr><td colspan="5" class="small">Nobody here yet.</td></tr>') + "</tbody></table>" +
      '<div class="actions" style="padding:0 16px 14px"><button class="btn gold" data-fb="send">Email the feedback link to the ticked people</button><span class="small" style="align-self:center">Anyone already emailed gets it as a reminder. People who have answered are never emailed again.</span></div></div>';
}

document.addEventListener("click", async (e) => {
  const el = (s) => e.target.closest(s);
  if (!el("#feedbackView")) return;
  try {
    if (el("[data-fbf]")) { fbFilter = el("[data-fbf]").dataset.fbf; return loadFeedback(); }
    if (el("[data-fbview]")) { const k = el("[data-fbview]").dataset.fbview; fbOpen = fbOpen === k ? null : k; return loadFeedback(); }
    if (el("[data-fbcopy]")) {
      const b = el("[data-fbcopy]");
      const r = await call("feedback-link", { key: b.dataset.fbcopy });
      await navigator.clipboard.writeText(r.link).catch(() => prompt("Copy this link", r.link));
      b.textContent = "Copied"; return;
    }
    if (el("[data-fb=send]")) {
      const keys = [...document.querySelectorAll("[data-fbtick]:checked")].map((x) => x.dataset.fbtick);
      if (!keys.length) return msg("Tick the people to email.");
      if (!confirm("Email the feedback link to " + keys.length + (keys.length === 1 ? " person?" : " people?"))) return;
      const r = await call("feedback-send", { keys }); msg(r.sent + " sent." + (r.failed ? " " + r.failed + " did not go: try them again." : ""), !r.failed); return loadFeedback();
    }
  } catch (err) { msg(err.message); }
});
`;
