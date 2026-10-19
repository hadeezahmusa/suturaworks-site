// The transactional emails. Built with tables and inline styles because
// email clients ignore most modern CSS. The ticket email follows the
// "Confirmation email" mockup. Nothing here promises a team name.

import { BANK, TIER_NAME, ngn, word } from "../../qlv2026/event.js";

const ASSETS = "https://suturaworks.com/qlv2026/assets";
const FONT = "Poppins, 'Segoe UI', Arial, sans-serif";
const MONO = "'IBM Plex Mono', Consolas, 'Courier New', monospace";
const C = { navy: "#0F2B63", blue: "#1A5AA8", teal: "#1F7D87", yel: "#EFC22D", ink: "#0E1B33", body: "#4A5B75", line: "#E3EBF4", panel: "#F4F8FC", link: "#14478F" };

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function first(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

function shell({ preheader, body, foot }) {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>QLV 2026</title></head>
<body style="margin:0;padding:0;background:#E3EBF4;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;color:#E3EBF4;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E3EBF4;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
<tr><td bgcolor="${C.navy}" style="background:${C.navy};background-image:linear-gradient(168deg,#0F2B63 0%,#1A5AA8 100%);padding:20px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td><img src="${ASSETS}/jci-aso-qlv-lockup-white.png" alt="JCI Aso, Quality Leadership Value" height="28" style="height:28px;width:auto;display:block;border:0;"></td>
    <td align="right" style="font-family:${FONT};font-size:9px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${C.yel};">6 &amp; 7 Nov 2026</td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 28px 22px;font-family:${FONT};">${body}</td></tr>
<tr><td style="background:${C.panel};border-top:1px solid ${C.line};padding:12px 28px;font-family:${FONT};font-size:10px;color:${C.body};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-family:${FONT};font-size:10px;color:${C.body};">${foot}</td>
    <td align="right" style="font-family:${FONT};font-size:10px;font-weight:500;color:${C.body};">JCI Aso &middot; Abuja</td>
  </tr></table>
</td></tr>
</table>
<p style="font-family:${FONT};font-size:10px;color:#5A6B85;margin:14px 0 0;">Registration for QLV 2026 is hosted by Sutura Works Limited for JCI Aso.</p>
</td></tr></table></body></html>`;
}

function h1(t) {
  return `<h1 style="margin:0 0 8px;font-family:${FONT};font-size:21px;font-weight:700;color:${C.ink};line-height:1.25;">${t}</h1>`;
}
function p(t, extra = "") {
  return `<p style="margin:0 0 14px;font-family:${FONT};font-size:13px;color:${C.body};line-height:1.6;${extra}">${t}</p>`;
}
function refBox(label, ref, sub = "") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background:#FFF8E2;border:1px solid ${C.yel};border-radius:9px;"><tr><td style="padding:14px 18px;font-family:${FONT};">
    <div style="font-size:11px;font-weight:700;color:${C.ink};">${label}</div>
    <div style="font-family:${MONO};font-size:20px;font-weight:600;color:${C.navy};letter-spacing:.5px;margin:2px 0;">${esc(ref)}</div>
    ${sub ? `<div style="font-size:11px;color:#6B5A1E;line-height:1.5;">${sub}</div>` : ""}
  </td></tr></table>`;
}
function button(href, label, gold = false) {
  const bg = gold ? C.yel : C.navy;
  const fg = gold ? C.navy : "#FFFFFF";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 16px;"><tr><td bgcolor="${bg}" style="background:${bg};border-radius:8px;">
    <a href="${esc(href)}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:13px;font-weight:600;color:${fg};text-decoration:none;">${label}</a></td></tr></table>`;
}
function rows(pairs) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid #D7E2EF;border-radius:10px;">${pairs.map(([k, v], i) =>
    `<tr><td style="padding:10px 16px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:11px;color:${C.body};width:38%;">${k}</td><td style="padding:10px 16px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:12px;font-weight:600;color:${C.ink};">${v}</td></tr>`).join("")}</table>`;
}
function days(adviser) {
  const line = (k, v) => `<tr><td valign="top" style="width:28px;padding:0 0 8px;font-family:${MONO};font-size:9px;font-weight:600;color:${C.blue};">${k}</td><td style="padding:0 0 8px;font-family:${FONT};font-size:11px;font-weight:500;color:${C.ink};line-height:1.45;">${v}</td></tr>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">${adviser
    ? line("D2", "Sat 7 Nov, 10:15am to about 3:00pm. Transcorp Hilton, Abuja")
    : line("D1", "Fri 6 Nov, 4:00pm. Virtual, link sent the day before") + line("D2", "Sat 7 Nov, 8:30am to 4:00pm. Transcorp Hilton, Abuja")}</table>`;
}

const CHIP = {
  standard: ["Standard", C.teal, "#FFFFFF"],
  member: ["JCI Aso member", C.yel, C.navy],
  corporate: ["Corporate seat", "#184E9E", "#FFFFFF"],
  judge: ["Judge or mentor", "#184E9E", "#FFFFFF"],
  sponsored: ["Sponsored seat", "#16537A", "#FFFFFF"],
  adviser: ["Adviser", "#FFFFFF", C.navy],
};

export function paidLine(ticket, reg) {
  if (ticket.kind === "standard" || ticket.kind === "member") return `Paid ${ngn(reg.amount)} by transfer`;
  if (ticket.kind === "corporate") return `Corporate pack, ${ngn(reg.amount)}`;
  if (ticket.kind === "judge") return "Free with the corporate pack";
  if (ticket.kind === "sponsored") return "Paid by a sponsor";
  return "By invitation";
}

// The ticket strip inside the email, after the mockup.
function ticketCard(t) {
  const [chip, bg, fg] = CHIP[t.kind] || CHIP.standard;
  const border = t.kind === "adviser" ? `border:1.5px solid ${C.navy};` : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border:1px solid #D7E2EF;border-radius:10px;overflow:hidden;"><tr>
  <td width="150" valign="top" bgcolor="${C.navy}" style="width:150px;background:${C.navy};padding:16px;font-family:${FONT};">
    <div style="font-size:15px;font-weight:800;color:#FFFFFF;line-height:1.15;">QUALITY</div>
    <div style="font-size:15px;font-weight:800;color:${C.navy};background:${C.yel};padding:1px 5px;line-height:1.15;display:inline-block;">LEADERSHIP</div>
    <div style="font-size:15px;font-weight:800;color:#FFFFFF;line-height:1.15;padding-left:30px;">VALUE</div>
    <div style="font-size:10px;font-weight:500;color:#CFE0F3;line-height:1.4;margin-top:16px;">Building Systems That Outlive You</div>
  </td>
  <td valign="top" style="padding:16px 18px;font-family:${FONT};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td valign="top" style="font-family:${FONT};">
        <div style="font-size:8px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${C.body};">Admit</div>
        <div style="font-size:15px;font-weight:700;color:${C.ink};line-height:1.25;margin-bottom:6px;">${esc(t.name)}</div>
        <div style="font-size:8px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${C.body};">Reference</div>
        <div style="font-family:${MONO};font-size:17px;font-weight:600;color:${C.navy};">${esc(t.ticket_ref)}</div>
      </td>
      <td valign="top" align="right"><span style="font-family:${FONT};font-size:8px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${fg};background:${bg};${border}padding:4px 8px;border-radius:3px;white-space:nowrap;">${chip}</span></td>
    </tr></table>
    <div style="height:1px;background:${C.line};margin:12px 0;line-height:1px;font-size:1px;">&nbsp;</div>
    ${days(t.kind === "adviser")}
    <div style="font-family:${FONT};font-size:11px;color:${C.body};">${t.kind === "adviser" || t.kind === "judge" ? "Not placed in a team" : "Team: announced on day one"}</div>
  </td></tr></table>`;
}

function questionsBlock(url, adviser) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px;background:${C.panel};border-left:3px solid ${C.yel};border-radius:0 8px 8px 0;"><tr><td style="padding:14px 16px;font-family:${FONT};">
    <div style="font-size:12px;font-weight:700;color:${C.ink};margin-bottom:6px;">${adviser ? "One ask before the day" : "One thing left to do"}</div>
    <div style="font-size:11px;color:${C.body};line-height:1.6;margin-bottom:8px;">${adviser
      ? "The six tasks come from real workplace problems people send in. If you have one worth putting in front of a team, it takes two minutes."
      : "The problems you will work on come from answers people send us, not from the committee. Three questions, two minutes."}</div>
    <a href="${esc(url)}" style="font-size:11px;font-weight:600;text-decoration:none;color:${C.link};">${adviser ? "Send a problem" : "Answer the three questions"} &rarr;</a>
  </td></tr></table>`;
}

// ---------- the emails ----------

export function proofReceived(reg, statusUrl) {
  const member = reg.tier === "member";
  const what = reg.tier === "sponsored" ? "your claim link goes to this address"
    : reg.tier === "corporate" ? "each person you named gets their own ticket by email"
    : "your ticket comes to this address";
  const body = h1("Proof received") +
    p(`Hello ${esc(first(reg.contact_person || reg.name))}, thank you. We have your proof of payment and are checking it against the JCI Aso account. As soon as it clears, usually within one working day, ${what}.`) +
    refBox("Your reference", reg.ref, "Quote this if you need to get in touch.") +
    rows([["Ticket", esc(TIER_NAME[reg.tier])], ["Amount", ngn(reg.amount)]]) +
    (member ? p("We are also checking your name against the JCI Aso member register. If it is not there we will contact you about the standard rate rather than cancel your place.") : "") +
    p(`You can check where things stand at any time: <a href="${esc(statusUrl)}" style="color:${C.link};font-weight:600;">your registration</a>.`, "font-size:12px;") +
    p("Nothing more from us after a working day? Reply to this email with your reference and the registration team will look it up.", "font-size:12px;margin:0;");
  return {
    subject: `Proof received for ${reg.ref}`,
    html: shell({ preheader: `We are checking your transfer for ${reg.ref}.`, body, foot: `<span style="font-family:${MONO};">${esc(reg.ref)}</span>` }),
    text: `Proof received\n\nHello ${first(reg.contact_person || reg.name)}, thank you. We have your proof of payment and are checking it against the JCI Aso account. As soon as it clears, usually within one working day, ${what}.\n\nYour reference: ${reg.ref}\nTicket: ${TIER_NAME[reg.tier]}\nAmount: ${ngn(reg.amount)}\n${member ? "\nWe are also checking your name against the JCI Aso member register. If it is not there we will contact you about the standard rate rather than cancel your place.\n" : ""}\nYour registration: ${statusUrl}\n`,
  };
}

export function ticketIssued(t, reg, links) {
  const adviser = t.kind === "adviser";
  const judge = t.kind === "judge";
  const intro = adviser
    ? `Hello ${first(t.name)}, thank you for giving the day. Your place is held and a calendar invitation is attached. Your reference is below.`
    : t.kind === "sponsored"
      ? `Hello ${first(t.name)}, your seat is claimed and paid for by your sponsor. Your ticket is below. Keep the reference, it is how we find you at the desk.`
      : judge
        ? `Hello ${first(t.name)}, ${reg.organisation} has named you as its judge or mentor for QLV 2026. You are not placed in a team: you rove and score on day two. Your ticket is below.`
        : `Hello ${first(t.name)}, your payment has come through and your seat is held. Your ticket is below. Keep the reference, it is how we find you at the desk.`;
  const heading = adviser ? "You are confirmed for QLV 2026" : "You are registered for QLV 2026";
  const after = adviser
    ? p("A one page brief with the six tasks reaches you a week before. Participants do not see them until the sprint opens, so please keep them to yourself. If something changes and you can no longer make it, reply as early as you can, because the roving routes are built around who is coming.", "font-size:12px;")
    : p("Day one is virtual and the joining link comes the day before. Your team is announced on day one, and its task is handed out as the sprint opens on day two, so there is nothing to prepare.", "font-size:12px;");
  const body = h1(heading) + p(esc(intro)) + ticketCard(t) +
    button(links.ticket, "Open your ticket") + after + questionsBlock(links.answer, adviser);
  return {
    subject: adviser ? `You are confirmed for QLV 2026, ${t.ticket_ref}` : `Your QLV 2026 ticket, ${t.ticket_ref}`,
    html: shell({ preheader: `${heading}. Reference ${t.ticket_ref}.`, body, foot: `${esc(paidLine(t, reg))} &middot; <span style="font-family:${MONO};">${esc(t.ticket_ref)}</span>` }),
    text: `${heading}\n\n${intro}\n\nAdmit: ${t.name}\nReference: ${t.ticket_ref}\n${adviser ? "D2: Sat 7 Nov, 10:15am to about 3:00pm. Transcorp Hilton, Abuja" : "D1: Fri 6 Nov, 4:00pm. Virtual, link sent the day before\nD2: Sat 7 Nov, 8:30am to 4:00pm. Transcorp Hilton, Abuja\nTeam: announced on day one"}\n\nOpen your ticket: ${links.ticket}\n${adviser ? "Send a problem" : "Answer the three questions"}: ${links.answer}\n`,
  };
}

export function corporateReceipt(reg, tickets) {
  const list = tickets.map((t) => `${esc(t.name)}${t.kind === "judge" ? " (judge or mentor)" : ""}, ${esc(t.email)}`);
  const body = h1("Transfer verified") +
    p(`Hello, thank you. The transfer for ${esc(reg.organisation)} has been checked against the JCI Aso account. ${word(tickets.length)} tickets have gone out, one to each person:`) +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;">${list.map((l) => `<tr><td style="padding:3px 0;font-family:${FONT};font-size:12px;color:${C.ink};">${l}</td></tr>`).join("")}</table>` +
    rows([["Reference", `<span style="font-family:${MONO};">${esc(reg.ref)}</span>`], ["Pack", `Team of ${word(reg.size).toLowerCase()}, plus a judge or mentor seat`], ["Paid", ngn(reg.amount)]]) +
    p("Your organisation is named from the front on both days, and the report on what your people produced comes to this address after the event.", "font-size:12px;margin:0;");
  return {
    subject: `Transfer verified, ${word(tickets.length).toLowerCase()} QLV 2026 tickets sent (${reg.ref})`,
    html: shell({ preheader: `Tickets sent for ${reg.ref}.`, body, foot: `Paid ${ngn(reg.amount)} by transfer &middot; <span style="font-family:${MONO};">${esc(reg.ref)}</span>` }),
    text: `Transfer verified\n\nThe transfer for ${reg.organisation} has been checked. Tickets sent to:\n${tickets.map((t) => `- ${t.name}${t.kind === "judge" ? " (judge or mentor)" : ""}, ${t.email}`).join("\n")}\n\nReference: ${reg.ref}\nPaid: ${ngn(reg.amount)}\n`,
  };
}

export function couldNotMatch(reg, note, retryUrl) {
  const body = h1("We could not match your transfer yet") +
    p(`Hello ${esc(first(reg.contact_person || reg.name))}, thank you for registering. We have looked for your transfer in the JCI Aso account and have not been able to match it to your registration yet. This usually comes down to the narration or a screenshot that is hard to read, and it is quick to sort out.`) +
    (note ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background:${C.panel};border-radius:8px;"><tr><td style="padding:13px 15px;font-family:${FONT};font-size:12px;color:${C.ink};line-height:1.6;">${esc(note).replace(/\n/g, "<br>")}</td></tr></table>` : "") +
    rows([["Reference to use as narration", `<span style="font-family:${MONO};">${esc(reg.ref)}</span>`], ["Amount", ngn(reg.amount)], ["Account", `${BANK.number}, ${BANK.name}, ${BANK.bank}`]]) +
    p("You can upload a clearer screenshot or the receipt from your bank here. Your seat stays held while we look again.") +
    button(retryUrl, "Upload your proof again") +
    p("Or simply reply to this email with the receipt attached and the date and time you sent the transfer.", "font-size:12px;margin:0;");
  return {
    subject: `About your QLV 2026 transfer, ${reg.ref}`,
    html: shell({ preheader: `We need a little more to match ${reg.ref}.`, body, foot: `<span style="font-family:${MONO};">${esc(reg.ref)}</span>` }),
    text: `We could not match your transfer yet\n\nHello ${first(reg.contact_person || reg.name)}, thank you for registering. We have not been able to match your transfer to your registration yet. This usually comes down to the narration or a screenshot that is hard to read.\n\n${note ? note + "\n\n" : ""}Reference to use as narration: ${reg.ref}\nAmount: ${ngn(reg.amount)}\nAccount: ${BANK.number}, ${BANK.name}, ${BANK.bank}\n\nUpload your proof again: ${retryUrl}\nOr reply to this email with the receipt attached.\n`,
  };
}

export function sponsorLink(reg, claimUrl, manageUrl, closeDate = "30 October") {
  const n = word(reg.size).toLowerCase();
  const body = h1(`Transfer verified, ${n} seats held`) +
    p(`Hello ${esc(first(reg.contact_person))}, thank you. Your transfer has been checked against the JCI Aso account and this email is your receipt. Now send the link below to the people you are sponsoring. Each one fills their own details and their ticket comes straight to them.`) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;background:${C.navy};border-radius:12px;"><tr><td style="padding:18px 20px;font-family:${FONT};">
      <div style="font-size:10px;font-weight:700;letter-spacing:1.7px;text-transform:uppercase;color:${C.yel};">Your claim link</div>
      <div style="font-size:12px;color:#CFE0F3;line-height:1.5;margin:4px 0 10px;">Anyone with this link can take one of your seats, so send it to named people rather than posting it in a group.</div>
      <a href="${esc(claimUrl)}" style="font-family:${MONO};font-size:13px;color:#FFFFFF;word-break:break-all;">${esc(claimUrl)}</a>
    </td></tr></table>` +
    rows([["Reference", `<span style="font-family:${MONO};">${esc(reg.ref)}</span>`], ["Seats", `${reg.size} at ${ngn(9500)}`], ["Paid", ngn(reg.amount)], ["Named as sponsor", reg.named_publicly ? "Yes" : "No, anonymous"]]) +
    p("We email you whenever somebody claims a seat. You can also see how many are claimed here:") +
    button(manageUrl, "See your seats", true) +
    p(`Unclaimed seats are released on ${closeDate} and refunded. Keep this email, because the link above to see your seats is private to you.`, "font-size:12px;margin:0;");
  return {
    subject: `Your QLV 2026 claim link, ${n} seats (${reg.ref})`,
    html: shell({ preheader: "Send this link to the people you are sponsoring.", body, foot: `Paid ${ngn(reg.amount)} by transfer &middot; <span style="font-family:${MONO};">${esc(reg.ref)}</span>` }),
    text: `Transfer verified, ${n} seats held\n\nYour transfer has been checked and this email is your receipt. Send the link below to the people you are sponsoring.\n\nYour claim link: ${claimUrl}\nAnyone with this link can take one of your seats, so send it to named people rather than posting it in a group.\n\nSee your seats: ${manageUrl}\nReference: ${reg.ref}\nPaid: ${ngn(reg.amount)}\n\nUnclaimed seats are released on ${closeDate} and refunded.\n`,
  };
}

export function seatClaimed(reg, t, taken, manageUrl, closeDate = "30 October") {
  const left = reg.size - taken;
  const status = left ? `${word(taken)} of ${reg.size} seats are now claimed, so ${word(left).toLowerCase()} ${left === 1 ? "is" : "are"} still open.` : `All ${reg.size} seats are now claimed. Thank you for sponsoring them.`;
  const body = h1("A seat has been claimed") +
    p(`Hello ${esc(first(reg.contact_person))}, ${esc(t.name)} has just claimed one of your seats and their ticket, ${esc(t.ticket_ref)}, has gone to them.`) +
    p(status) + button(manageUrl, "See your seats", true) +
    (left ? p(`Unclaimed seats are released on ${closeDate}.`, "font-size:12px;margin:0;") : "");
  return {
    subject: `${t.name} claimed a seat (${taken} of ${reg.size})`,
    html: shell({ preheader: status, body, foot: `<span style="font-family:${MONO};">${esc(reg.ref)}</span>` }),
    text: `A seat has been claimed\n\n${t.name} has claimed one of your seats and their ticket, ${t.ticket_ref}, has gone to them.\n${status}\n\nSee your seats: ${manageUrl}\n`,
  };
}

export function adminLogin(url) {
  const body = h1("Sign in to QLV 2026 admin") +
    p("Use the button below to sign in. It works once and expires in 15 minutes.") +
    button(url, "Sign in") +
    p("If you did not ask for this, ignore this email. Nobody can sign in without the link.", "font-size:12px;margin:0;");
  return {
    subject: "Your QLV 2026 admin sign-in link",
    html: shell({ preheader: "Your sign-in link, valid for 15 minutes.", body, foot: "Admin" }),
    text: `Sign in to QLV 2026 admin (valid for 15 minutes, works once):\n${url}\n`,
  };
}

// Calendar invitation for advisers, attached to their confirmation.
export function adviserIcs(t) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JCI Aso//QLV 2026//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${t.ticket_ref}@qlv2026.suturaworks.com`, `DTSTAMP:${stamp}`,
    "DTSTART:20261107T091500Z", "DTEND:20261107T140000Z",
    "SUMMARY:QLV 2026, adviser and judge",
    "LOCATION:Transcorp Hilton\\, Abuja",
    `DESCRIPTION:Reference ${t.ticket_ref}. Arrive 10:15am to collect your badge and roving route at the desk.`,
    "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
