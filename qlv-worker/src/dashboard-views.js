// The Dashboard tab: a dark infographic of every headline number. Plain SVG,
// no libraries. Colours are a validated categorical set for the navy
// surface (dataviz validator, dark mode, surface #0e2147: all checks pass).
// Every chart has hover tips and a "See the numbers" table.

export const DASH_STYLE = String.raw`
#dashView{--dsurf:#0e2147;--dpage:#0a1838;--dt1:#eef3fb;--dt2:#a9b9d6;--dt3:#7f93b8;--dgrid:#22396a;
  --s1:#3987e5;--s2:#d95926;--s3:#199e70;--s4:#c98500;--s5:#d55181;--gold:#efc22d}
#dashView .dash{background:var(--dpage);border-radius:16px;padding:18px;color:var(--dt1)}
#dashView .dhead{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap;margin:0 0 14px}
#dashView .dhead h2{font-family:Poppins,sans-serif;font-size:22px;margin:0;color:var(--dt1)}
#dashView .dhead .sub{font-size:13px;color:var(--dt2)}
#dashView .dgrid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px}
#dashView .dc{background:var(--dsurf);border:1px solid #1b3263;border-radius:14px;padding:14px 16px;grid-column:span 6;min-width:0}
#dashView .w3{grid-column:span 3}#dashView .w4{grid-column:span 4}#dashView .w8{grid-column:span 8}#dashView .w12{grid-column:span 12}
#dashView .dc h3{font-family:Poppins,sans-serif;font-size:14px;font-weight:600;margin:0 0 2px;color:var(--dt1)}
#dashView .dc .dnote{font-size:12px;color:var(--dt2);margin:0 0 8px}
#dashView svg{width:100%;height:auto;display:block;overflow:visible}
#dashView svg text{font-family:"Source Sans 3",system-ui,sans-serif;fill:var(--dt2)}
#dashView .kpi{display:flex;align-items:center;gap:12px}
#dashView .kpi svg{width:86px;flex:0 0 86px}
#dashView .kpi b{display:block;font-family:Poppins,sans-serif;font-size:26px;line-height:1.1;color:var(--dt1)}
#dashView .kpi span{font-size:12px;color:var(--dt2)}
#dashView .hero{font-family:Poppins,sans-serif;font-size:34px;font-weight:700;color:var(--dt1);line-height:1.1}
#dashView .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--dt2);margin:0 0 6px}
#dashView .legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
#dashView details{margin-top:8px;font-size:12px;color:var(--dt2)}
#dashView details summary{cursor:pointer;color:var(--dt3)}
#dashView details table{width:100%;border-collapse:collapse;margin-top:6px}
#dashView details td,#dashView details th{border-bottom:1px solid var(--dgrid);padding:4px 6px;text-align:left;color:var(--dt2);font-weight:400}
#dashView .hit{fill:transparent;cursor:default}
#dashTip{position:fixed;pointer-events:none;background:#06102a;color:#eef3fb;border:1px solid #2a4580;border-radius:8px;padding:6px 9px;font-size:12px;z-index:50;max-width:240px;box-shadow:0 6px 18px rgba(0,0,0,.35)}
#dashView .mini{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
#dashView .mini div{background:#0a1a3c;border-radius:10px;padding:10px 12px}
#dashView .mini b{display:block;font-family:Poppins,sans-serif;font-size:22px;color:var(--dt1)}
#dashView .mini span{font-size:12px;color:var(--dt2)}
@media (max-width:900px){#dashView .dc,#dashView .w3,#dashView .w4,#dashView .w8{grid-column:span 12}#dashView .w3.k{grid-column:span 6}}
@media (max-width:520px){#dashView .w3.k{grid-column:span 12}#dashView .dash{padding:12px}}
`;

export const DASH_HTML = String.raw`<div id="dashView" hidden><div id="dashBox"></div></div><div id="dashTip" hidden></div>`;

export const DASH_JS = String.raw`
// On a phone the charts are drawn on a narrower canvas so their text stays readable.
const DNARROW = () => (document.getElementById("dashBox")?.clientWidth || 1000) < 640;
function dFit(o) { if (DNARROW()) { o.w = 360; if (o.label) o.label = Math.min(o.label, 112); if (o.endW) o.endW = Math.min(o.endW, 104); } return o; }
const DN = (n) => (n === null || n === undefined || n === "" ? "-" : Number(n).toLocaleString("en-GB"));
const DM = (n) => "₦" + Math.round(n || 0).toLocaleString("en-GB");
const DD = (d) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const DPCT = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const dtip = (t) => ' data-tip="' + esc(t) + '"';
const nice = (m) => { if (m <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(m))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= m) return k * p; return 10 * p; };
function dTable(head, rows) { return "<details><summary>See the numbers</summary><table><tr>" + head.map((h) => "<th>" + esc(h) + "</th>").join("") + "</tr>" + rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") + "</table></details>"; }

// A ring meter: the share filled, the number in the middle.
function dRing(pct, color) {
  const r = 34, c = 2 * Math.PI * r, f = Math.max(0, Math.min(100, pct)) / 100;
  return '<svg viewBox="0 0 86 86" role="img" aria-label="' + pct + ' percent"><circle cx="43" cy="43" r="' + r + '" fill="none" stroke="#1b3263" stroke-width="9"/>' +
    '<circle cx="43" cy="43" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (c * f).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 43 43)"/>' +
    '<text x="43" y="48" text-anchor="middle" style="font-family:Poppins,sans-serif;font-size:16px;font-weight:700;fill:#eef3fb">' + pct + "%</text></svg>";
}
function dKpi(label, value, sub, pct, color) {
  return '<div class="dc w3 k"><div class="kpi">' + (pct === null ? "" : dRing(pct, color)) + "<div><b>" + value + "</b><span>" + esc(label) + (sub ? "<br>" + esc(sub) : "") + "</span></div></div></div>";
}
// Columns on one baseline. data: [{label, v, tip, color?}]
function dCols(data, o) {
  o = dFit(Object.assign({ w: 520, h: 200, color: "var(--s1)", every: 1 }, o || {}));
  if (DNARROW() && data.length > 8) o.every = Math.max(o.every, Math.ceil(data.length / 5));
  const L = 34, B = 26, T = 14, max = nice(Math.max(1, ...data.map((d) => d.v))), iw = o.w - L - 6, ih = o.h - B - T;
  const bw = Math.max(4, Math.min(34, iw / data.length - 4)), step = iw / Math.max(1, data.length);
  let g = "";
  for (let i = 0; i <= 4; i++) { const y = T + ih - (ih * i) / 4; g += '<line x1="' + L + '" x2="' + (o.w - 6) + '" y1="' + y + '" y2="' + y + '" stroke="var(--dgrid)" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11">' + DN((max * i) / 4) + "</text>"; }
  data.forEach((d, i) => {
    const x = L + i * step + (step - bw) / 2, h = (d.v / max) * ih, y = T + ih - h;
    g += '<path d="M' + x + "," + (T + ih) + "V" + (y + Math.min(4, h)) + "q0,-4 4,-4h" + (bw - 8) + "q4,0 4,4V" + (T + ih) + 'Z" fill="' + (d.color || o.color) + '"/>';
    g += '<rect class="hit" x="' + (L + i * step) + '" y="' + T + '" width="' + step + '" height="' + ih + '"' + dtip(d.tip || d.label + ": " + DN(d.v)) + "/>";
    if (i % o.every === 0) g += '<text x="' + (x + bw / 2) + '" y="' + (o.h - 8) + '" text-anchor="middle" font-size="11">' + esc(d.label) + "</text>";
  });
  return '<svg viewBox="0 0 ' + o.w + " " + o.h + '" role="img" aria-label="' + esc(o.aria || "chart") + '">' + g + "</svg>";
}
// Horizontal bars. data: [{label, v, max, tip, color, end}]
function dBars(data, o) {
  o = dFit(Object.assign({ w: 520, row: 30, label: 110, max: null, endW: 70 }, o || {}));
  const max = o.max || nice(Math.max(1, ...data.map((d) => d.v))), iw = o.w - o.label - o.endW, h = data.length * o.row + 8;
  let g = "";
  data.forEach((d, i) => {
    const y = 4 + i * o.row, w = Math.max(2, (d.v / max) * iw);
    const fit = Math.floor((o.label - 10) / 6.3), lab = d.label.length > fit ? d.label.slice(0, fit - 1) + "…" : d.label;
    g += '<text x="' + (o.label - 8) + '" y="' + (y + o.row / 2 + 4) + '" text-anchor="end" font-size="12" style="fill:var(--dt1)"><title>' + esc(d.label) + "</title>" + esc(lab) + "</text>";
    g += '<rect x="' + o.label + '" y="' + (y + 7) + '" width="' + iw + '" height="' + (o.row - 14) + '" rx="4" fill="#132a57"/>';
    g += '<rect x="' + o.label + '" y="' + (y + 7) + '" width="' + w + '" height="' + (o.row - 14) + '" rx="4" fill="' + (d.color || "var(--s1)") + '"/>';
    g += '<text x="' + (o.label + iw + 8) + '" y="' + (y + o.row / 2 + 4) + '" font-size="12" style="fill:var(--dt1)">' + esc(d.end !== undefined ? d.end : DN(d.v)) + "</text>";
    g += '<rect class="hit" x="0" y="' + y + '" width="' + o.w + '" height="' + o.row + '"' + dtip(d.tip || d.label + ": " + DN(d.v)) + "/>";
  });
  return '<svg viewBox="0 0 ' + o.w + " " + h + '" role="img" aria-label="' + esc(o.aria || "chart") + '">' + g + "</svg>";
}
// Paired bars on one scale: two series per row, with a 2px surface gap.
function dPairs(data, names, o) {
  o = dFit(Object.assign({ w: 520, row: 34, label: 110 }, o || {}));
  const max = nice(Math.max(1, ...data.flatMap((d) => [d.a, d.b]))), iw = o.w - o.label - 50, h = data.length * o.row + 8;
  let g = "";
  data.forEach((d, i) => {
    const y = 4 + i * o.row, wa = Math.max(2, (d.a / max) * iw), wb = Math.max(d.b ? 2 : 0, (d.b / max) * iw);
    g += '<text x="' + (o.label - 8) + '" y="' + (y + o.row / 2 + 4) + '" text-anchor="end" font-size="12" style="fill:var(--dt1)">' + esc(d.label) + "</text>";
    g += '<rect x="' + o.label + '" y="' + (y + 5) + '" width="' + wa + '" height="11" rx="3" fill="var(--s1)"/><text x="' + (o.label + wa + 6) + '" y="' + (y + 14) + '" font-size="11">' + DN(d.a) + "</text>";
    g += '<rect x="' + o.label + '" y="' + (y + 18) + '" width="' + wb + '" height="11" rx="3" fill="var(--s3)"/><text x="' + (o.label + wb + 6) + '" y="' + (y + 27) + '" font-size="11">' + DN(d.b) + "</text>";
    g += '<rect class="hit" x="0" y="' + y + '" width="' + o.w + '" height="' + o.row + '"' + dtip(d.label + ": " + names[0] + " " + DN(d.a) + ", " + names[1] + " " + DN(d.b) + (d.a ? " (" + DPCT(d.b, d.a) + "%)" : "")) + "/>";
  });
  return '<div class="legend"><span><i style="background:var(--s1)"></i>' + esc(names[0]) + '</span><span><i style="background:var(--s3)"></i>' + esc(names[1]) + "</span></div>" +
    '<svg viewBox="0 0 ' + o.w + " " + h + '" role="img" aria-label="' + esc(o.aria || "chart") + '">' + g + "</svg>";
}
// Running total as an area with a 2px line and an end label.
function dArea(data, o) {
  o = dFit(Object.assign({ w: 520, h: 210 }, o || {}));
  const L = 34, B = 26, T = 18, R = 40, max = nice(Math.max(1, ...data.map((d) => d.v))), iw = o.w - L - R, ih = o.h - B - T;
  const X = (i) => L + (data.length < 2 ? iw / 2 : (iw * i) / (data.length - 1)), Y = (v) => T + ih - (v / max) * ih;
  let g = '<defs><linearGradient id="dAreaG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3987e5" stop-opacity=".45"/><stop offset="1" stop-color="#3987e5" stop-opacity=".02"/></linearGradient></defs>';
  for (let i = 0; i <= 4; i++) { const y = T + ih - (ih * i) / 4; g += '<line x1="' + L + '" x2="' + (o.w - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--dgrid)"/><text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="11">' + DN((max * i) / 4) + "</text>"; }
  const pts = data.map((d, i) => X(i).toFixed(1) + "," + Y(d.v).toFixed(1));
  if (data.length) {
    g += '<path d="M' + X(0) + "," + (T + ih) + "L" + pts.join("L") + "L" + X(data.length - 1) + "," + (T + ih) + 'Z" fill="url(#dAreaG)"/>';
    g += '<path d="M' + pts.join("L") + '" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>';
    const l = data[data.length - 1];
    g += '<circle cx="' + X(data.length - 1) + '" cy="' + Y(l.v) + '" r="5" fill="var(--s1)" stroke="var(--dsurf)" stroke-width="2"/><text x="' + (X(data.length - 1) + 8) + '" y="' + (Y(l.v) + 4) + '" font-size="12" style="fill:var(--dt1);font-weight:700">' + DN(l.v) + "</text>";
  }
  const every = Math.max(1, Math.ceil(data.length / (DNARROW() ? 4 : 7)));
  data.forEach((d, i) => {
    if ((i % every === 0 && data.length - 1 - i >= every / 2) || i === data.length - 1) g += '<text x="' + X(i) + '" y="' + (o.h - 8) + '" text-anchor="middle" font-size="11">' + esc(d.label) + "</text>";
    const w = iw / Math.max(1, data.length - 1);
    g += '<rect class="hit" x="' + (X(i) - w / 2) + '" y="' + T + '" width="' + w + '" height="' + ih + '"' + dtip(d.tip) + "/>";
  });
  return '<svg viewBox="0 0 ' + o.w + " " + o.h + '" role="img" aria-label="' + esc(o.aria || "chart") + '">' + g + "</svg>";
}
// One whole split into parts, with 2px surface gaps and a legend.
function dSeg(parts, o) {
  o = dFit(Object.assign({ w: 520, h: 26 }, o || {}));
  const tot = parts.reduce((s, p) => s + p.v, 0) || 1;
  let x = 0, g = "";
  parts.forEach((p) => {
    const w = (p.v / tot) * o.w;
    if (w > 0) g += '<rect x="' + (x + (x ? 1 : 0)) + '" y="0" width="' + Math.max(0, w - (x ? 2 : 1)) + '" height="' + o.h + '" rx="4" fill="' + p.color + '"' + dtip(p.label + ": " + (p.fmt || DN)(p.v) + " (" + DPCT(p.v, tot) + "%)") + "/>";
    x += w;
  });
  return '<div class="legend">' + parts.map((p) => '<span><i style="background:' + p.color + '"></i>' + esc(p.label) + " " + (p.fmt || DN)(p.v) + "</span>").join("") + "</div>" +
    '<svg viewBox="0 0 ' + o.w + " " + o.h + '" role="img" aria-label="' + esc(o.aria || "parts") + '">' + g + "</svg>";
}
// Net Promoter Score on a half dial from -100 to +100.
function dNps(nps) {
  const v = nps === null ? 0 : nps, a = Math.PI * (1 - (v + 100) / 200), r = 70, cx = 100, cy = 88;
  const arc = (a0, a1, col) => '<path d="M' + (cx + r * Math.cos(a0)) + "," + (cy - r * Math.sin(a0)) + "A" + r + "," + r + " 0 0 1 " + (cx + r * Math.cos(a1)) + "," + (cy - r * Math.sin(a1)) + '" fill="none" stroke="' + col + '" stroke-width="14"/>';
  return '<svg viewBox="0 0 200 110" role="img" aria-label="Net Promoter Score ' + (nps === null ? "none yet" : nps) + '">' +
    arc(Math.PI, Math.PI * 0.62, "#d95926") + arc(Math.PI * 0.6, Math.PI * 0.42, "#5b6b8c") + arc(Math.PI * 0.4, 0, "#199e70") +
    (nps === null ? "" : '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + (r - 18) * Math.cos(a)) + '" y2="' + (cy - (r - 18) * Math.sin(a)) + '" stroke="#eef3fb" stroke-width="3" stroke-linecap="round"/><circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#eef3fb"/>') +
    '<text x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle" style="font-family:Poppins,sans-serif;font-size:18px;font-weight:700;fill:#eef3fb">' + (nps === null ? "-" : (nps > 0 ? "+" : "") + nps) + "</text>" +
    '<text x="22" y="105" font-size="10">-100</text><text x="178" y="105" text-anchor="end" font-size="10">+100</text></svg>';
}

const KIND_LABEL = { ticket_issued: "Tickets", ticket_resent: "Tickets resent", ticket_meet: "Tickets with meeting link", member_code: "Member codes", rooms_announced: "Team announced", lobby_welcome: "Team room links", certificate: "Certificates", thank_you: "Thank-yous", feedback_request: "Feedback requests", feedback_reminder: "Feedback reminders", composed: "Written by admin", login: "Sign-in links", meet_link: "Meeting links", pack: "Briefing packs", answers_reminder: "Survey reminders", query: "Payment queries", partner_links: "Sponsor seat links", invoice: "Invoices" };

let dashData = null, dashNarrow = null;
async function loadDashboard() { dashData = await call("dashboard"); drawDashboard(); }
window.addEventListener("resize", () => { if (dashData && !$("#dashView").hidden && DNARROW() !== dashNarrow) drawDashboard(); });
function drawDashboard() {
  const d = dashData; dashNarrow = DNARROW();
  const k = d.kpis, f = d.feedback, m = d.money;
  const regData = d.regDaily.map((r) => ({ label: DD(r.day), v: r.total, tip: DD(r.day) + ": " + DN(r.n) + " seats booked, " + DN(r.total) + " in total" }));
  const arr = d.arrivals.map((a) => ({ label: a.slot, v: a.n, tip: a.slot + " to " + a.slot.slice(0, 3) + (a.slot.endsWith("00") ? "29" : "59") + ": " + DN(a.n) + " arrived" }));
  const teamMax = 25;
  const teamBars = d.teams.filter((t) => t.avg !== null && t.avg !== undefined).map((t) => ({
    label: (t.place ? ["", "1st ", "2nd ", "3rd "][t.place] : "") + t.name, v: t.avg, end: t.avg.toFixed(1) + " / 25",
    color: t.place === 1 ? "var(--gold)" : "var(--s1)", tip: t.name + ": " + t.avg.toFixed(1) + " / 25, Outlives the team " + (t.outlives ?? 0).toFixed(1) + " / 5" }));
  const emailsDaily = d.emailsDaily.map((e) => ({ label: DD(e.day), v: e.n, tip: DD(e.day) + ": " + DN(e.n) + " emails" }));
  const kindsTop = d.emailsByKind.slice(0, 7).map((e) => ({ label: KIND_LABEL[e.kind] || e.kind.replace(/_/g, " "), v: e.n }));
  const att = f.attend || { yes: 0, maybe: 0, no: 0 };
  $("#dashBox").innerHTML = '<div class="dash"><div class="dhead"><div><h2>QLV 2026 at a glance</h2><div class="sub">Live from the platform · ' + esc(when(d.generatedAt)) + (d.winner ? " · Winning team: " + esc(d.winner) : "") + '</div></div><button class="btn ghost" data-dash="refresh" style="background:#132a57;color:#eef3fb;border-color:#2a4580">Refresh</button></div>' +
    '<div class="dgrid">' +
      dKpi("sprinters attended", DN(k.attended) + " / " + DN(k.registered), "registered and seated", DPCT(k.attended, k.registered), "var(--s1)") +
      dKpi("staff present", DN(k.staffCame) + " / " + DN(k.staff), "judges, mentors, facilitators", DPCT(k.staffCame, k.staff), "var(--s3)") +
      dKpi("certificates emailed", DN(k.certsSent) + " / " + DN(k.certs), "of those earned", DPCT(k.certsSent, k.certs), "var(--s4)") +
      dKpi("feedback answered", DN(k.feedbackIn) + " / " + DN(k.feedbackAsked), "of people asked", DPCT(k.feedbackIn, k.feedbackAsked), "var(--s5)") +

      '<div class="dc w8"><h3>Registrations over time</h3><p class="dnote">Seats booked, running total</p>' + (regData.length ? dArea(regData, { aria: "Seats booked over time" }) : '<p class="dnote">No bookings yet.</p>') +
        dTable(["Day", "Seats booked", "Running total"], d.regDaily.map((r) => [DD(r.day), r.n, r.total])) + "</div>" +
      '<div class="dc w4"><h3>Money</h3><p class="dnote">Cash in and where it went</p><div class="hero">' + DM(m.balance) + '</div><p class="dnote" style="margin-top:2px">Balance after spending</p>' +
        dSeg([{ label: "Tickets", v: m.tickets, color: "var(--s1)", fmt: DM }, { label: "Sponsors", v: m.sponsors, color: "var(--s4)", fmt: DM }, { label: "Other", v: m.other, color: "var(--s3)", fmt: DM }], { aria: "Income" }) +
        '<div style="height:10px"></div>' + dSeg([{ label: "Spent", v: m.paid, color: "var(--s2)", fmt: DM }, { label: "Owed", v: m.owed, color: "var(--s5)", fmt: DM }, { label: "In-kind", v: m.inKind, color: "var(--s3)", fmt: DM }], { aria: "Costs" }) +
        dTable(["Item", "Amount"], [["Cash in", DM(m.cashIn)], ["Spent", DM(m.paid)], ["Owed", DM(m.owed)], ["In-kind value", DM(m.inKind)], ["Balance", DM(m.balance)], ["Full cost of the event", DM(m.fullCost)]]) + "</div>" +

      '<div class="dc"><h3>Team results</h3><p class="dnote">Average of the judges\' totals, out of 25</p>' + (teamBars.length ? dBars(teamBars, { max: teamMax, aria: "Team averages" }) : '<p class="dnote">No scores yet.</p>') +
        dTable(["Team", "Average / 25", "Outlives / 5", "Place"], d.teams.map((t) => [t.name, t.avg === null ? "-" : t.avg.toFixed(1), t.outlives === null ? "-" : t.outlives.toFixed(1), t.place || ""])) + "</div>" +
      '<div class="dc"><h3>Team turnout</h3><p class="dnote">Seated before the day against checked in</p>' + dPairs(d.teams.map((t) => ({ label: t.name, a: t.seated, b: t.came })), ["Seated", "Attended"], { aria: "Team turnout" }) +
        dTable(["Team", "Seated", "Attended"], d.teams.map((t) => [t.name, t.seated, t.came])) + "</div>" +

      '<div class="dc"><h3>Arrivals on the day</h3><p class="dnote">' + (d.mainDay ? esc(DD(d.mainDay)) + ", by half hour. Some times are late because of the internet glitch at the desk." : "No check-ins yet.") + "</p>" +
        (arr.length ? dCols(arr, { color: "var(--s3)", every: arr.length > 10 ? 2 : 1, aria: "Arrivals by half hour" }) : "") + dTable(["From", "Arrived"], d.arrivals.map((a) => [a.slot, a.n])) + "</div>" +
      '<div class="dc"><h3>Turnout by ticket type</h3><p class="dnote">Tickets issued against people who came</p>' + dPairs(d.kinds.map((x) => ({ label: x.label, a: x.tickets, b: x.came })), ["Tickets", "Attended"], { aria: "Turnout by ticket type" }) +
        dTable(["Type", "Tickets", "Attended"], d.kinds.map((x) => [x.label, x.tickets, x.came])) + (d.miva ? '<p class="dnote" style="margin-top:8px">MIVA Open University: ' + DN(d.miva.came) + " of " + DN(d.miva.places) + " sponsored places used</p>" : "") + "</div>" +

      '<div class="dc w4"><h3>How was it?</h3><p class="dnote">Overall rating, ' + DN(f.n) + (f.n === 1 ? " answer" : " answers") + "</p>" + dCols(f.overallDist.map((v, i) => ({ label: String(i + 1), v, tip: (i + 1) + " of 5, " + ["Poor", "Fair", "Good", "Very good", "Excellent"][i] + ": " + DN(v) + " people" })), { w: 300, h: 170, color: "var(--s5)", aria: "Overall rating" }) +
        '<p class="dnote">Average ' + (f.overall || "-") + " out of 5</p></div>" +
      '<div class="dc w4"><h3>Would recommend</h3><p class="dnote">Net Promoter Score: promoters (9 to 10) less detractors (0 to 6)</p>' + dNps(f.nps) +
        '<p class="dnote" style="text-align:center">Average ' + (f.recommend || "-") + " out of 10</p>" + dTable(["Score", "People"], f.recommendDist.map((v, i) => [i, v])) + "</div>" +
      '<div class="dc w4"><h3>What happens next</h3><p class="dnote">From the feedback form</p>' +
        dSeg([{ label: "Yes", v: att.yes, color: "var(--s3)" }, { label: "Maybe", v: att.maybe, color: "var(--s4)" }, { label: "No", v: att.no, color: "var(--s2)" }], { aria: "Will attend again" }) +
        '<p class="dnote" style="margin:4px 0 10px">Will attend another JCI Aso programme</p><div class="mini"><div><b>' + DN(f.membership) + "</b><span>want membership information</span></div><div><b>" + DN(f.eventEmails) + "</b><span>want event emails</span></div></div></div>" +

      '<div class="dc"><h3>Emails sent</h3><p class="dnote">' + DN(k.emails) + " in total, per day</p>" + (emailsDaily.length ? dCols(emailsDaily, { every: Math.max(1, Math.ceil(emailsDaily.length / 8)), aria: "Emails per day" }) : "") +
        dTable(["Day", "Emails"], d.emailsDaily.map((e) => [DD(e.day), e.n])) + "</div>" +
      '<div class="dc"><h3>What the emails were</h3><p class="dnote">Top kinds</p>' + dBars(kindsTop, { label: 150, color: "var(--s1)", aria: "Emails by kind" }) +
        dTable(["Kind", "Emails"], d.emailsByKind.map((e) => [KIND_LABEL[e.kind] || e.kind, e.n])) + "</div>" +

      '<div class="dc w4"><h3>Team rooms</h3><p class="dnote">The lobby and team room app</p><div class="mini"><div><b>' + DN(d.rooms.people) + "</b><span>people with a link</span></div><div><b>" + DN(d.rooms.opened) + "</b><span>opened it (" + DPCT(d.rooms.opened, d.rooms.people) + "%)</span></div><div><b>" + DN(d.rooms.installed) + "</b><span>installed the app</span></div><div><b>" + DN(d.rooms.messages) + "</b><span>messages posted</span></div></div></div>" +
      '<div class="dc w8"><h3>Sponsors</h3><p class="dnote">Confirmed sponsors by level</p>' + (d.sponsors.length ? dBars(d.sponsors.map((s, i) => ({ label: s.level, v: s.amount, end: DM(s.amount) + " (" + s.n + ")", color: ["var(--s4)", "var(--s1)", "var(--s3)", "var(--s5)"][i % 4], tip: s.level + ": " + s.n + (s.n === 1 ? " sponsor, " : " sponsors, ") + DM(s.amount) })), { w: 820, label: 170, endW: 130, aria: "Sponsors by level" }) : '<p class="dnote">None confirmed yet.</p>') +
        (d.spendByCategory.length ? '<h3 style="margin-top:12px">Where the costs went</h3><p class="dnote">Paid, owed and in-kind by category</p>' + dBars(d.spendByCategory.map((c) => ({ label: c.category, v: c.total, end: DM(c.total), color: "var(--s2)" })), { w: 820, label: 210, endW: 120, aria: "Costs by category" }) : "") +
        dTable(["Item", "Amount"], [...d.sponsors.map((x) => [x.level + " (" + x.n + ")", DM(x.amount)]), ...d.spendByCategory.map((c) => [c.category, DM(c.total)])]) + "</div>" +
    "</div></div>";
}
document.addEventListener("mousemove", (e) => {
  const tip = document.getElementById("dashTip"); if (!tip) return;
  const t = e.target.closest && e.target.closest("#dashView [data-tip]");
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.getAttribute("data-tip"); tip.hidden = false;
  const x = Math.min(window.innerWidth - 250, e.clientX + 14), y = e.clientY + 16;
  tip.style.left = x + "px"; tip.style.top = y + "px";
});
document.addEventListener("click", (e) => {
  const tip = document.getElementById("dashTip");
  const t = e.target.closest && e.target.closest("#dashView [data-tip]");
  if (tip) { if (t) { tip.textContent = t.getAttribute("data-tip"); tip.hidden = false; tip.style.left = Math.min(window.innerWidth - 250, e.clientX + 10) + "px"; tip.style.top = (e.clientY + 14) + "px"; } else tip.hidden = true; }
  if (e.target.closest && e.target.closest("[data-dash=refresh]")) loadDashboard().catch((err) => msg(err.message));
});
`;
