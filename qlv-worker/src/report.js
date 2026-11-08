// The master report: everything the platform holds about QLV 2026, sheet by
// sheet, for the final report. The admin's browser turns this into one Excel
// workbook (report-views.js), because a Worker on the free plan has only a
// few milliseconds of CPU. Admin only. Secrets never leave: no tokens, link
// keys, push keys or payment proofs, only whether a proof was uploaded.

import { tableName, PARTNER_LEVELS } from "./config.js";
import { staffPeople } from "./briefings.js";

const KIND = { standard: "Standard", member: "JCI Aso member", corporate: "Corporate", sponsored: "Sponsored seat", partner: "Sponsor seat", adviser: "Mentor/adviser", judge: "Judge", facilitator: "Facilitator" };
const SPRINTERS = ["standard", "member", "corporate", "sponsored", "partner"];
const team = (i) => (i === null || i === undefined ? "" : tableName(i));
const yes = (v) => (v ? "Yes" : "No");
const sheet = (name, cols, rows) => ({ name, cols, rows: rows.map((r) => cols.map((c) => r[c] ?? "")) });
const all = (env, sql, ...b) => env.DB.prepare(sql).bind(...b).all().then((r) => r.results);

export async function reportData(env) {
  const [regs, tickets, checks, partners, pseats, scores, unlocks, certs, thanks, emails, mails, invoices, msgs, posts, intros, access, answers, members, logos, tasks, lobbyTeam, deskStage] = await Promise.all([
    all(env, "SELECT * FROM registrations ORDER BY created_at"),
    all(env, `SELECT t.*, r.tier, r.status AS reg_status, r.organisation AS reg_org, r.name AS reg_name, p.name AS partner_name FROM tickets t JOIN registrations r ON r.ref = t.reg_ref
      LEFT JOIN partners p ON p.id = t.partner_id WHERE t.ticket_ref != 'pending' ORDER BY t.id`),
    all(env, "SELECT * FROM checkins"),
    all(env, "SELECT * FROM partners ORDER BY id"),
    all(env, "SELECT partner_id, COUNT(*) AS seats, SUM(ticket_id IS NOT NULL) AS claimed FROM partner_seats WHERE voided_at IS NULL GROUP BY partner_id"),
    all(env, "SELECT * FROM scores ORDER BY table_index, judge_ticket_id"),
    all(env, "SELECT * FROM score_unlocks ORDER BY unlocked_at"),
    all(env, "SELECT * FROM certificates ORDER BY id"),
    all(env, "SELECT * FROM thanks_sent ORDER BY sent_at"),
    all(env, "SELECT id, created_at, kind, recipient, ref, ok, detail FROM email_log ORDER BY id"),
    all(env, "SELECT * FROM mail_sent ORDER BY id"),
    all(env, "SELECT * FROM invoices ORDER BY id"),
    all(env, "SELECT * FROM lobby_messages ORDER BY id"),
    all(env, "SELECT * FROM lobby_posts ORDER BY id"),
    all(env, "SELECT * FROM lobby_intros"),
    all(env, "SELECT ticket_id, created_at, revoked_at, notified_at, notified_by, announced_at, last_opened_at, installed, push_state FROM lobby_access ORDER BY id"),
    all(env, "SELECT branch, a1, a2, a3, created_at FROM answers ORDER BY created_at"),
    all(env, "SELECT code, name, email, status, added_at FROM members ORDER BY name"),
    all(env, "SELECT * FROM screen_logos WHERE deleted_at IS NULL ORDER BY id"),
    all(env, "SELECT tt.table_index, s.* FROM table_tasks tt JOIN sprint_tasks s ON s.id = tt.task_id ORDER BY tt.table_index"),
    all(env, "SELECT * FROM lobby_team ORDER BY id"),
    all(env, "SELECT * FROM access ORDER BY role, email"),
  ]);
  const { computeTally } = await import("./scoring.js");
  const { moneyRows, MONEY_COLS, moneyView } = await import("./money.js");
  const { feedbackAdmin, feedbackRows, FEEDBACK_COLS } = await import("./feedback.js");
  const { thanksPeopleFor } = await import("./certs.js");
  const [tally, money, mv, fb, fbRows, staff, thanksList, results] = await Promise.all([
    computeTally(env), moneyRows(env), moneyView(env), feedbackAdmin(env), feedbackRows(env), staffPeople(env), thanksPeopleFor(env), env.KV.get("cert:results", "json"),
  ]);

  const byTicket = Object.fromEntries(tickets.map((t) => [t.id, t]));
  const checkin = Object.fromEntries(checks.map((c) => [c.ticket_id, c]));
  const nameOf = (id) => (byTicket[id] ? byTicket[id].name : id < 0 ? (lobbyTeam.find((m) => m.id === -id) || {}).name || "" : "");
  const live = tickets.filter((t) => !t.cancelled_at);
  const sprinters = live.filter((t) => SPRINTERS.includes(t.kind));
  const came = (list) => list.filter((t) => checkin[t.id]).length;
  const held = (t) => t.tier === "sponsored" && !["verified", "confirmed"].includes(t.reg_status);
  const fbBy = Object.fromEntries(fb.people.map((p) => [p.key, p]));
  const top = results ? results.top : [];
  const place = (i) => (top.indexOf(i) >= 0 ? ["First", "Second", "Third"][top.indexOf(i)] : "");

  // ---------- Summary ----------
  const sm = [];
  const add = (section, item, value) => sm.push({ Section: section, Item: item, Value: value });
  add("Report", "Generated", new Date().toISOString());
  add("Report", "Event", "Quality Leadership Value 2026, JCI Aso: Fri 6 Nov (virtual) and Sat 7 Nov 2026 (Transcorp Hilton, Abuja)");
  for (const tier of [...new Set(regs.map((r) => r.tier))]) {
    const rs = regs.filter((r) => r.tier === tier);
    add("Registrations", `${tier}: bookings`, rs.length);
    add("Registrations", `${tier}: seats`, rs.reduce((n, r) => n + (r.size || 0), 0));
    for (const st of [...new Set(rs.map((r) => r.status))]) add("Registrations", `${tier}: ${st}`, rs.filter((r) => r.status === st).length);
  }
  for (const k of Object.keys(KIND)) {
    const ts = live.filter((t) => t.kind === k);
    if (!ts.length) continue;
    add("Tickets and attendance", `${KIND[k]}: tickets`, ts.length);
    add("Tickets and attendance", `${KIND[k]}: checked in`, came(ts));
  }
  add("Tickets and attendance", "Cancelled tickets", tickets.filter((t) => t.cancelled_at).length);
  add("Tickets and attendance", "Sprinters with tickets", sprinters.length);
  add("Tickets and attendance", "Sprinters checked in (Saturday)", came(sprinters));
  add("Tickets and attendance", "Sprinters who did not come", sprinters.length - came(sprinters));
  add("Tickets and attendance", "Staff checked in (judges, mentors, facilitators)", came(live.filter((t) => !SPRINTERS.includes(t.kind))));
  const miva = live.filter((t) => t.reg_ref === "QLV26-017");
  if (miva.length) { add("MIVA Open University", "Places sponsored", miva.length); add("MIVA Open University", "Attended", came(miva)); add("MIVA Open University", "Did not attend", miva.length - came(miva)); add("MIVA Open University", "Payment status", (regs.find((r) => r.ref === "QLV26-017") || {}).status || ""); }
  const teams = [...new Set(sprinters.filter((t) => t.table_index !== null).map((t) => t.table_index))].sort((a, b) => a - b);
  add("Teams", "Teams", teams.length);
  for (const i of teams) add("Teams", `${tableName(i)}: seated / attended`, `${sprinters.filter((t) => t.table_index === i).length} / ${came(sprinters.filter((t) => t.table_index === i))}`);
  tally.order.forEach((r, i) => add("Results", `${i + 1}. ${r.name}`, `${r.avgText} / 25 (Outlives the team ${r.outlivesText} / 5)`));
  if (results) add("Results", "Confirmed top three", top.map(tableName).join(", "));
  add("Judging", "Judges", tally.judges.length);
  add("Judging", "Scores submitted", scores.filter((s) => s.locked).length);
  add("Judging", "Scores unlocked and corrected", unlocks.length);
  const paid = partners.filter((p) => p.status === "confirmed");
  add("Sponsors", "Confirmed sponsors", paid.length);
  add("Sponsors", "Awaiting payment", partners.length - paid.length);
  const MONEY_LABEL = { tickets: "Ticket income", partners: "Sponsorship income", other: "Other income", cashIn: "Total cash in", paid: "Spent and paid", owed: "Still owed",
    balance: "Balance (cash in less paid)", afterOwed: "Balance after what is owed", inKind: "In-kind support (value)", fullCost: "Full cost of the event (paid, owed and in-kind)" };
  for (const [k, v] of Object.entries(mv.totals || {})) add("Money (NGN)", MONEY_LABEL[k] || k, v);
  add("Certificates", "Certificates made", certs.length);
  add("Certificates", "Certificates emailed", certs.filter((c) => c.sent_at).length);
  add("Certificates", "Held for sponsor payment", sprinters.filter((t) => checkin[t.id] && held(t)).length);
  add("Thank-yous", "Thank-you emails sent", thanks.length);
  const s = fb.summary;
  add("Feedback", "People asked", s.people); add("Feedback", "Answered", s.submitted);
  add("Feedback", "Overall, average out of 5", s.overall ?? ""); add("Feedback", "Would recommend, average out of 10", s.recommend ?? ""); add("Feedback", "Net Promoter Score", s.nps ?? "");
  add("Feedback", "Will attend again: yes / maybe / no", `${s.attend.yes} / ${s.attend.maybe} / ${s.attend.no}`);
  add("Feedback", "Want membership information", s.membership); add("Feedback", "Want event emails", s.eventEmails); add("Feedback", "Shared social handles", s.socials);
  add("Emails", "Emails sent", emails.filter((e) => e.ok).length);
  add("Emails", "Emails that failed", emails.filter((e) => !e.ok).length);
  for (const k of [...new Set(emails.map((e) => e.kind))].sort()) add("Emails", `Sent: ${k}`, emails.filter((e) => e.ok && e.kind === k).length);
  add("Team rooms", "People with a team room link", access.filter((a) => !a.revoked_at).length);
  add("Team rooms", "Opened their link", access.filter((a) => !a.revoked_at && a.last_opened_at).length);
  add("Team rooms", "Installed the app", access.filter((a) => !a.revoked_at && a.installed).length);
  add("Team rooms", "Messages posted", msgs.length);
  add("Team rooms", "Announcements posted", posts.length);

  // ---------- detail ----------
  const regCols = ["Ref", "Ticket type", "Seats", "Amount (NGN)", "Status", "Name", "Email", "Phone", "Organisation", "Situation", "Member no", "Member year", "Contact person", "Named publicly", "Role", "Invited by", "Mode", "Attendees listed", "Proof uploaded", "Query note", "Registered", "Verified", "Verified by", "Ticket sent", "Queried", "Released"];
  const regRows = regs.map((r) => ({ Ref: r.ref, "Ticket type": r.tier, Seats: r.size, "Amount (NGN)": r.amount, Status: r.status, Name: r.name, Email: r.email, Phone: r.phone, Organisation: r.organisation, Situation: r.situation,
    "Member no": r.member_no, "Member year": r.member_year, "Contact person": r.contact_person, "Named publicly": r.named_publicly === null ? "" : yes(r.named_publicly), Role: r.role, "Invited by": r.invited_by, Mode: r.mode,
    "Attendees listed": r.attendees ? (() => { try { return JSON.parse(r.attendees).map((a) => a.name + (a.email ? ` <${a.email}>` : "")).join("; "); } catch { return r.attendees; } })() : "",
    "Proof uploaded": r.proof_at ? `Yes, ${r.proof_at}` : "No", "Query note": r.query_note, Registered: r.created_at, Verified: r.verified_at, "Verified by": r.verified_by, "Ticket sent": r.sent_at, Queried: r.queried_at, Released: r.released_at }));

  const attCols = ["Ticket", "Booking", "Type", "Name", "Badge name", "Email", "Phone", "Organisation", "Role", "Situation", "Days", "Team", "Seated", "Seated by", "Late addition", "Checked in", "Arrived (check-in time)", "Checked in by", "Booking status", "Sponsor", "Ticket sent", "Cancelled"];
  const attRows = tickets.map((t) => ({ Ticket: t.ticket_ref, Booking: t.reg_ref, Type: KIND[t.kind] || t.kind, Name: t.name, "Badge name": t.badge_name, Email: t.email, Phone: t.phone,
    Organisation: t.organisation || t.reg_org || "", Role: t.role, Situation: t.situation, Days: t.days, Team: team(t.table_index), Seated: t.seated_at, "Seated by": t.seated_by_user || t.seated_by,
    "Late addition": t.late_addition ? "Yes" : "", "Checked in": yes(checkin[t.id]), "Arrived (check-in time)": checkin[t.id]?.arrived_at, "Checked in by": checkin[t.id]?.marked_by, "Booking status": t.reg_status,
    Sponsor: t.partner_name || (t.tier === "sponsored" ? t.reg_name : ""), "Ticket sent": t.sent_at, Cancelled: t.cancelled_at }));

  const teamCols = ["Team", "Place", "Average / 25", "Outlives the team / 5", "Judges scored", "Seated", "Attended", "Members who attended", "Did not attend", "Sprint task", "Sector"];
  const teamRows = teams.map((i) => {
    const ms = sprinters.filter((t) => t.table_index === i), tr = tally.rows.find((r) => r.index === i) || {}, task = tasks.find((x) => x.table_index === i) || {};
    return { Team: tableName(i), Place: place(i), "Average / 25": tr.avg ?? "", "Outlives the team / 5": tr.outlives ?? "", "Judges scored": tr.scored !== undefined ? `${tr.scored} of ${tr.expected}` : "",
      Seated: ms.length, Attended: came(ms), "Members who attended": ms.filter((t) => checkin[t.id]).map((t) => t.name).join("; "), "Did not attend": ms.filter((t) => !checkin[t.id]).map((t) => t.name).join("; "),
      "Sprint task": task.title || "", Sector: task.sector || "" };
  });

  const crit = tally.criteria.map((c, i) => `${i + 1}. ${c.name} (1 to 5)`);
  const scoreCols = ["Team", "Judge", ...crit, "Total / 25", "Submitted", "Locked", "Unlocked by", "Unlocked at", "Unlock reason"];
  const scoreRows = scores.map((r) => ({ Team: team(r.table_index), Judge: nameOf(r.judge_ticket_id), ...Object.fromEntries(crit.map((c, i) => [c, r["c" + (i + 1)]])), "Total / 25": r.total,
    Submitted: r.submitted_at, Locked: yes(r.locked), "Unlocked by": r.unlocked_by, "Unlocked at": r.unlocked_at, "Unlock reason": r.unlock_reason }));
  const resCols = ["Rank", "Team", "Presentation time", "Average / 25", "Outlives the team / 5", "Judges scored", "Tied", "Confirmed place"];
  const resRows = tally.rows.map((r) => ({ Rank: tally.order.indexOf(r) >= 0 ? tally.order.indexOf(r) + 1 : "", Team: r.name, "Presentation time": r.time, "Average / 25": r.avg ?? "", "Outlives the team / 5": r.outlives ?? "",
    "Judges scored": `${r.scored} of ${r.expected}`, Tied: r.tied ? "Yes" : "", "Confirmed place": place(r.index) })).sort((a, b) => (a.Rank || 99) - (b.Rank || 99));
  const unlockCols = ["Team", "Judge", "Previous score", "Reason", "Unlocked by", "Unlocked at"];
  const unlockRows = unlocks.map((u) => ({ Team: team(u.table_index), Judge: nameOf(u.judge_ticket_id), "Previous score": u.previous, Reason: u.reason, "Unlocked by": u.unlocked_by, "Unlocked at": u.unlocked_at }));

  const judgeById = Object.fromEntries(tally.judges.map((j) => [j.id, j]));
  const staffCols = ["Name", "Email", "Ticket", "Kind", "Judge", "Mentor", "Teams mentored", "Checked in", "Arrived"];
  const staffRows = [
    ...staff.map((p) => ({ Name: p.name, Email: p.email, Ticket: p.ref, Kind: KIND[p.kind] || p.kind, Judge: yes(p.judge), Mentor: yes(p.mentor),
      "Teams mentored": (judgeById[p.id]?.advised || p.tables || []).map(team).join(", "), "Checked in": yes(checkin[p.id]), Arrived: checkin[p.id]?.arrived_at })),
    ...lobbyTeam.filter((m) => !m.removed_at).map((m) => ({ Name: m.name, Email: m.email, Kind: m.marshal ? "Lead Sprint Marshal" : "QLV team (team rooms)" })),
    ...deskStage.map((a) => ({ Name: a.name || "", Email: a.email, Kind: a.role === "stage" ? "Stage coordinator login" : a.role === "desk" ? "Check-in desk login" : a.role })),
  ];

  const seatsBy = Object.fromEntries(pseats.map((p) => [p.partner_id, p]));
  const spCols = ["Sponsor", "Level", "Amount (NGN)", "Seats included", "Seats claimed", "Status", "Confirmed", "Payment note", "Contact", "Contact email", "Added"];
  const spRows = partners.map((p) => ({ Sponsor: p.name, Level: PARTNER_LEVELS[p.level]?.name || p.level, "Amount (NGN)": p.amount, "Seats included": p.seats_total, "Seats claimed": seatsBy[p.id]?.claimed ?? 0,
    Status: p.status, Confirmed: p.confirmed_at, "Payment note": p.payment_note, Contact: p.contact_name, "Contact email": p.contact_email, Added: p.created_at }));

  const invCols = ["Number", "Billed to", "Contact", "Email", "Phone", "Issued", "Due", "Items", "Subtotal (NGN)", "Total (NGN)", "Seats", "Emailed", "Cancelled"];
  const invRows = invoices.map((v) => ({ Number: v.number, "Billed to": v.bill_org, Contact: [v.bill_title, v.bill_contact].filter(Boolean).join(" "), Email: v.bill_email, Phone: v.bill_phone, Issued: v.issue_date, Due: v.due_date,
    Items: (() => { try { return JSON.parse(v.lines).map((l) => `${l.title || l.description}: ${l.qty} x ${l.unit} = ${l.amount}`).join("; "); } catch { return v.lines; } })(),
    "Subtotal (NGN)": v.subtotal, "Total (NGN)": v.total, Seats: v.seats, Emailed: v.emailed_at, Cancelled: v.cancelled_at }));

  const certCols = ["Certificate", "Second certificate", "Name printed", "Ticket", "Team", "Certificate type", "Emailed", "Feedback answered", "Held for sponsor payment"];
  const certRows = certs.map((c) => {
    const t = byTicket[c.ticket_id] || {}, win = top[0] === t.table_index && t.table_index !== undefined;
    const id = "QLV26-C-" + String(c.id).padStart(3, "0");
    return { Certificate: id, "Second certificate": win ? id + "-P" : "", "Name printed": c.printed_name, Ticket: t.ticket_ref, Team: team(t.table_index),
      "Certificate type": win ? "Achievement and Participation" : "Participation", Emailed: c.sent_at, "Feedback answered": fbBy[`c:${c.ticket_id}`]?.submittedAt || "", "Held for sponsor payment": held(t) ? "Yes" : "" };
  });
  const thanksBy = Object.fromEntries(thanksList.map((p) => [p.key, p]));
  const thxCols = ["Name", "Email", "Role", "Thank-you sent", "Feedback answered"];
  const thxRows = thanks.map((x) => ({ Name: x.name, Email: x.email, Role: thanksBy[x.key]?.roleLabel || "", "Thank-you sent": x.sent_at, "Feedback answered": fbBy[x.key]?.submittedAt || "" }));

  const fbStCols = ["Name", "Email", "Role", "Team", "Emailed", "Opened", "Answered"];
  const fbStRows = fb.people.map((p) => ({ Name: p.name, Email: p.email, Role: p.roleLabel, Team: p.group, Emailed: p.emailedAt, Opened: p.openedAt, Answered: p.submittedAt }));
  const fbWant = (k) => fb.people.filter((p) => p.answers && p.answers[k]).map((p) => ({ Name: p.name, Email: p.email, Role: p.roleLabel }));

  const space = (s) => (s === "lobby" ? "Lobby (everyone)" : /^t:\d+$/.test(s) ? "Team " + tableName(Number(s.slice(2))) : s);
  const msgCols = ["Posted", "Room", "From", "Role", "Message", "Hidden"];
  const msgRows = msgs.map((m) => ({ Posted: m.created_at, Room: space(m.space), From: nameOf(m.ticket_id) || (m.ticket_id === 0 ? "QLV team" : ""), Role: m.sender_role, Message: m.body, Hidden: m.hidden ? `Yes, by ${m.hidden_by || ""}` : "" }));
  const postCols = ["Created", "Audience", "Status", "Sent", "Announcement"];
  const postRows = posts.map((p) => ({ Created: p.created_at, Audience: space(p.audience), Status: p.status, Sent: p.sent_at, Announcement: p.body }));
  const introCols = ["Name", "Team", "What they do", "Hoping for", "Hide organisation", "Updated"];
  const introRows = intros.map((i) => ({ Name: nameOf(i.ticket_id), Team: team(byTicket[i.ticket_id]?.table_index), "What they do": i.what_you_do, "Hoping for": i.hoping_for, "Hide organisation": i.hide_org ? "Yes" : "", Updated: i.updated_at }));
  const accCols = ["Name", "Type", "Team", "Link emailed", "Emailed as", "Team announcement", "Last opened", "Installed app", "Notifications"];
  const accRows = access.filter((a) => !a.revoked_at).map((a) => ({ Name: nameOf(a.ticket_id), Type: a.ticket_id < 0 ? "QLV team" : KIND[byTicket[a.ticket_id]?.kind] || "", Team: team(byTicket[a.ticket_id]?.table_index),
    "Link emailed": a.notified_at, "Emailed as": a.notified_by, "Team announcement": a.announced_at, "Last opened": a.last_opened_at, "Installed app": a.installed ? "Yes" : "", Notifications: a.push_state }));

  const mailCols = ["When", "Kind", "To", "Booking or person", "Delivered", "Detail"];
  const mailRows = emails.map((e) => ({ When: e.created_at, Kind: e.kind, To: e.recipient, "Booking or person": e.ref, Delivered: yes(e.ok), Detail: e.detail }));
  const compCols = ["Sent", "To", "CC", "Subject", "Message", "Attachments", "Delivered", "Sent by"];
  const compRows = mails.map((m) => ({ Sent: m.sent_at, To: m.to_list, CC: m.cc_list, Subject: m.subject, Message: m.body,
    Attachments: (() => { try { return JSON.parse(m.attachments || "[]").map((a) => a.filename || a.name || a).join("; "); } catch { return m.attachments || ""; } })(), Delivered: yes(m.ok), "Sent by": m.sent_by }));

  const ansCols = ["Branch", "Answer 1", "Answer 2", "Answer 3", "Given on"];
  const ansRows = answers.map((a) => ({ Branch: a.branch, "Answer 1": a.a1, "Answer 2": a.a2, "Answer 3": a.a3, "Given on": String(a.created_at || "").slice(0, 10) }));
  const memCols = ["Code", "Name", "Email", "Status", "Added"];
  const memRows = members.map((m) => ({ Code: m.code, Name: m.name, Email: m.email, Status: m.status, Added: m.added_at }));
  const logoCols = ["Name", "Source", "Owner", "Logo on file", "Added"];
  const logoRows = logos.map((l) => ({ Name: l.name || "", Source: l.source, Owner: l.owner, "Logo on file": l.logo_at ? "Yes" : "No", Added: l.created_at }));
  const taskCols = ["Team", "Code", "Title", "Sector", "Situation", "People", "Problem", "Work", "Out of bounds"];
  const taskRows = tasks.map((t) => ({ Team: team(t.table_index), Code: t.code, Title: t.title, Sector: t.sector, Situation: t.situation, People: t.people, Problem: t.problem, Work: t.work, "Out of bounds": t.out_of_bounds }));

  return {
    generatedAt: new Date().toISOString(),
    sheets: [
      sheet("Summary", ["Section", "Item", "Value"], sm),
      sheet("Registrations", regCols, regRows),
      sheet("Attendees and check-in", attCols, attRows),
      sheet("Teams", teamCols, teamRows),
      sheet("Results", resCols, resRows),
      sheet("Scores by judge", scoreCols, scoreRows),
      sheet("Score corrections", unlockCols, unlockRows),
      sheet("Staff", staffCols, staffRows),
      sheet("Sponsors", spCols, spRows),
      sheet("Money", MONEY_COLS, money),
      sheet("Invoices", invCols, invRows),
      sheet("Certificates", certCols, certRows),
      sheet("Thank-yous", thxCols, thxRows),
      sheet("Feedback answers", FEEDBACK_COLS, fbRows),
      sheet("Feedback status", fbStCols, fbStRows),
      sheet("Want membership info", ["Name", "Email", "Role"], fbWant("membership_info")),
      sheet("Want event emails", ["Name", "Email", "Role"], fbWant("event_emails")),
      sheet("Registration answers", ansCols, ansRows),
      sheet("Team room messages", msgCols, msgRows),
      sheet("Team room announcements", postCols, postRows),
      sheet("Team room intros", introCols, introRows),
      sheet("Team room access", accCols, accRows),
      sheet("Emails sent", mailCols, mailRows),
      sheet("Emails written by admin", compCols, compRows),
      sheet("Sprint tasks", taskCols, taskRows),
      sheet("JCI Aso members", memCols, memRows),
      sheet("Logos on screen", logoCols, logoRows),
    ],
  };
}
