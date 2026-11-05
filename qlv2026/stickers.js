// QLV 2026 sprinter name stickers, drawn as a PDF in the browser with
// pdf-lib. Port of templates/name-sticker.html and name-sticker-blank.html
// from the Name Stickers handover: 99.1 by 67.7 mm, drawn in the template's
// own units (10 per mm). Navy band with the white logos and "QLV 2026", the
// full name large, the table in the yellow tag bottom left, the ticket
// reference bottom right. No footer, no contact details, no ticket type.
//
// QLVStickers.load(siteUrl) once, then
//   QLVStickers.sheets(stickers, layout)   8 per A4 sheet
//   QLVStickers.singles(stickers)          one per page at label size
// where a sticker is { name, tableNo, table, ticket } or { blank: true }.
// QLVStickers.fit(name) says whether a name fits (for the "too long" flag).
(function () {
  const MM = 72 / 25.4, U = MM / 10;           // points per mm, per template unit
  const W = 991, H = 677;
  const NAVY = [0.0588, 0.1686, 0.3882], YEL = [0.9373, 0.7608, 0.1765], GREY = [0.3529, 0.4196, 0.5216];
  let A = null, F = null;

  async function load(site) {
    if (A) return A;
    const get = async (p) => { const r = await fetch(site + p); if (!r.ok) throw new Error("Could not load " + p + " for the stickers."); return new Uint8Array(await r.arrayBuffer()); };
    const [heavy, mono, jci, qlv] = await Promise.all(["vendor/fonts/Poppins-ExtraBold.ttf", "vendor/fonts/IBMPlexMono-SemiBold.ttf", "assets/jci-aso-white.png", "assets/qlv-white.png"].map(get));
    A = { heavy, mono, jci, qlv };
    return A;
  }

  // Width in template units, with the template's letter spacing.
  const wid = (font, text, size, track = 0) => font.widthOfTextAtSize(text, size) + track * size * Math.max(0, [...text].length - 1);

  // The name in at most two balanced lines at 88, stepping down by 4 to 64.
  // Past that it may take three lines at 64, and is flagged, never cut.
  function lay(font, name) {
    const words = String(name).trim().split(/\s+/);
    for (let size = 88; size >= 64; size -= 4) {
      const w = (t) => wid(font, t, size, -0.015);
      if (w(words.join(" ")) <= 879) return { size, lines: [words.join(" ")], fits: true };
      let best = null;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(" "), b = words.slice(i).join(" "), m = Math.max(w(a), w(b));
        if (m <= 879 && (!best || m < best.m)) best = { m, lines: [a, b] };
      }
      if (best) return { size, lines: best.lines, fits: true };
    }
    // Greedy at the minimum, as many lines as it needs.
    const size = 64, lines = []; let cur = "";
    for (const word of words) { const t = cur ? cur + " " + word : word; if (cur && wid(font, t, size, -0.015) > 879) { lines.push(cur); cur = word; } else cur = t; }
    if (cur) lines.push(cur);
    return { size, lines, fits: false };
  }

  async function fonts(doc) {
    doc.registerFontkit(window.fontkit);
    return { heavy: await doc.embedFont(A.heavy, { subset: true }), mono: await doc.embedFont(A.mono, { subset: true }), jci: await doc.embedPng(A.jci), qlv: await doc.embedPng(A.qlv) };
  }

  // Draws one sticker with its top-left corner at (ox, oy) points from the page's top-left.
  function draw(page, f, ox, oy, s) {
    const { rgb } = window.PDFLib, PH = page.getHeight();
    const c = (a, o) => rgb(a[0], a[1], a[2]);
    const X = (x) => ox + x * U, Y = (y) => PH - oy - y * U;
    const text = (t, font, size, x, base, color, opts = {}) => {
      const track = opts.track || 0;
      let at = opts.right ? x - wid(font, t, size, track) - (opts.trailing ? track * size : 0) : x;
      if (!track) { page.drawText(t, { x: X(at), y: Y(base), size: size * U, font, color: c(color) }); return; }
      for (const ch of t) { page.drawText(ch, { x: X(at), y: Y(base), size: size * U, font, color: c(color) }); at += font.widthOfTextAtSize(ch, size) + track * size; }
    };
    const rr = (x, y, w, h, r, color) => page.drawSvgPath(`M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`, { x: X(x), y: Y(y), scale: U, color: c(color) });
    // The band, its top corners following the label's 2.8 mm rounding.
    page.drawSvgPath(`M 28 0 H ${W - 28} A 28 28 0 0 1 ${W} 28 V 120 H 0 V 28 A 28 28 0 0 1 28 0 Z`, { x: X(0), y: Y(0), scale: U, color: c(NAVY) });
    page.drawImage(f.jci, { x: X(56), y: Y(29 + 62), width: 128.3 * U, height: 62 * U });
    page.drawRectangle({ x: X(206.3), y: Y(33 + 54), width: 2 * U, height: 54 * U, color: rgb(0.949, 0.9647, 0.9882), opacity: 0.45 });
    page.drawImage(f.qlv, { x: X(230.3), y: Y(32 + 56), width: 91.2 * U, height: 56 * U });
    const yw = wid(f.heavy, "2026", 40);
    text("2026", f.heavy, 40, 935 - yw, 74, YEL);
    text("QLV ", f.heavy, 40, 935 - yw - wid(f.heavy, "QLV ", 40), 74, [1, 1, 1]);
    // Labels: IBM Plex Mono, letter-spaced.
    text("TABLE", f.mono, 22, 56, 534.6, GREY, { track: 0.16 });
    if (s.blank) {
      text("FULL NAME", f.mono, 22, 56, 182.6, GREY, { track: 0.16 });
      page.drawRectangle({ x: X(56), y: Y(322), width: 879 * U, height: 3 * U, color: c(NAVY) });
      rr(56, 549, 364, 84, 14, YEL);
      rr(68, 559, 64, 64, 10, NAVY);
      text("TICKET", f.mono, 22, 935, 575.6, GREY, { track: 0.16, right: true, trailing: true });
      page.drawRectangle({ x: X(635), y: Y(633), width: 300 * U, height: 3 * U, color: c(NAVY) });
      return;
    }
    // The name.
    const L = lay(f.heavy, s.name), lh = L.size * 1.04;
    const first = 160 + (lh - 1.4 * L.size) / 2 + 1.05 * L.size;
    L.lines.forEach((ln, i) => text(ln, f.heavy, L.size, 56, first + i * lh, NAVY, { track: -0.015 }));
    // The table tag: number in the navy square, then the name.
    const tw = wid(f.heavy, s.table, 46);
    rr(56, 549, 12 + 64 + 14 + tw + 24, 84, 14, YEL);
    rr(68, 559, 64, 64, 10, NAVY);
    const nw = wid(f.heavy, String(s.tableNo), 44);
    text(String(s.tableNo), f.heavy, 44, 100 - nw / 2, 606.2, [1, 1, 1]);
    text(s.table, f.heavy, 46, 146, 607.3, NAVY);
    // The ticket reference.
    text("TICKET", f.mono, 22, 935, 578.6, GREY, { track: 0.16, right: true, trailing: true });
    text(s.ticket, f.mono, 40, 935, 628, NAVY, { right: true });
  }

  async function newDoc(title) {
    const doc = await window.PDFLib.PDFDocument.create();
    doc.setTitle(title); doc.setAuthor("JCI Aso, Quality Leadership Value 2026"); doc.setCreator("QLV 2026");
    return doc;
  }

  // 8 per A4 sheet; the layout is in mm and can be changed for other label stock.
  async function sheets(list, layout) {
    const g = Object.assign({ left: 4.65, top: 13.1, colPitch: 101.6, rowPitch: 67.7, cols: 2, rows: 4 }, layout || {});
    const doc = await newDoc("QLV 2026 name stickers"), f = await fonts(doc);
    const per = g.cols * g.rows;
    for (let i = 0; i < list.length; i += per) {
      const page = doc.addPage([210 * MM, 297 * MM]);
      list.slice(i, i + per).forEach((s, k) => draw(page, f, (g.left + (k % g.cols) * g.colPitch) * MM, (g.top + Math.floor(k / g.cols) * g.rowPitch) * MM, s));
    }
    return doc.save();
  }

  async function singles(list) {
    const doc = await newDoc("QLV 2026 name stickers"), f = await fonts(doc);
    for (const s of list) draw(doc.addPage([W * U, H * U]), f, 0, 0, s);
    return doc.save();
  }

  // Whether a name fits in two lines at 64 or more; needs a loaded font, so
  // it measures with fontkit straight from the TTF.
  let fk = null;
  function fit(name) {
    if (!fk) fk = window.fontkit.create(A.heavy);
    const font = { widthOfTextAtSize: (t, size) => fk.layout(t).advanceWidth * size / fk.unitsPerEm };
    return lay(font, name).fits;
  }

  window.QLVStickers = { load, sheets, singles, fit };
})();
