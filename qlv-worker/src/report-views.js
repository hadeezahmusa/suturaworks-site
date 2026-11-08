// The master report button: fetches every sheet from /admin/api/report and
// writes one Excel workbook in this browser (plain SpreadsheetML in a zip,
// using ctZip from certs-views.js). Header rows are bold and frozen, with a
// filter on every sheet.

export const REPORT_JS = String.raw`
function rpXml(s) { return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function rpCol(i) { let s = ""; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function rpCell(v, r, c, head) {
  const ref = rpCol(c) + r, st = head ? ' s="1"' : "";
  if (v === null || v === undefined || v === "") return head ? '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t></t></is></c>' : "";
  if (typeof v === "number" && isFinite(v)) return '<c r="' + ref + '"' + st + "><v>" + v + "</v></c>";
  const t = String(v).slice(0, 32000);
  return '<c r="' + ref + '"' + st + ' t="inlineStr"><is><t xml:space="preserve">' + rpXml(t) + "</t></is></c>";
}
function rpSheet(sh) {
  const rows = [sh.cols, ...sh.rows];
  const widths = sh.cols.map((c, i) => Math.min(60, Math.max(10, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))));
  const last = rpCol(sh.cols.length - 1) + rows.length;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    "<cols>" + widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("") + "</cols><sheetData>" +
    rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + r.map((v, ci) => rpCell(v, ri + 1, ci, ri === 0)).join("") + "</row>").join("") +
    "</sheetData>" + (sh.rows.length ? '<autoFilter ref="A1:' + last + '"/>' : "") + "</worksheet>";
}
function rpName(n, used) {
  let s = String(n).replace(/[\[\]:*?\/\\]/g, " ").slice(0, 31) || "Sheet";
  let k = 2, base = s; while (used.has(s)) s = base.slice(0, 28) + " " + k++;
  used.add(s); return s;
}
function rpWorkbook(sheets) {
  const enc = (s) => new TextEncoder().encode(s), used = new Set();
  const names = sheets.map((s) => rpName(s.name, used));
  const files = [
    { name: "[Content_Types].xml", data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join("") + "</Types>") },
    { name: "_rels/.rels", data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: "xl/workbook.xml", data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map((n, i) => '<sheet name="' + rpXml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join("") + "</sheets></workbook>") },
    { name: "xl/_rels/workbook.xml.rels", data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join("") +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>') },
    { name: "xl/styles.xml", data: enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F2B63"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>') },
    ...sheets.map((s, i) => ({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", data: enc(rpSheet(s)) })),
  ];
  return new Blob([ctZip(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-report]");
  if (!b) return;
  e.preventDefault();
  try {
    msg("Gathering every record for the master report…", true);
    const d = await call("report");
    const blob = rpWorkbook(d.sheets);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "QLV-2026-Master-Report-" + d.generatedAt.slice(0, 10) + ".xlsx"; a.click();
    msg("Master report downloaded: " + d.sheets.length + " sheets, " + d.sheets.reduce((n, s) => n + s.rows.length, 0) + " rows.", true);
  } catch (err) { msg(err.message); }
});
`;
