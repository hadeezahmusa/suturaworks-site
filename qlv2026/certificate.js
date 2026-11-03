// QLV 2026 e-certificate, drawn as a PDF in the browser with pdf-lib.
// Matches QLV-2026-E-Certificate-Designs-Final.pdf: A4 landscape, ivory
// ground, navy border with a thin yellow line and yellow diamond corners, a
// navy band with the white logos and the certificate ID, the title, the
// name, the wording, the dates, two signatures and the yellow seal. No
// footer. Positions are the design's own, in CSS pixels on a 1123 by 794
// page, turned into PDF points here.
//
// Used by the admin page: QLVCert.load(siteUrl) once, then
// QLVCert.build(cert, signatures) for each person, which returns PDF bytes.
(function () {
  const K = 0.75, PW = 1123 * K, PH = 794 * K;
  const X = (x) => x * K, Y = (y) => PH - y * K;
  let A = null;

  async function load(site) {
    if (A) return A;
    const get = async (path) => {
      const r = await fetch(site + path);
      if (!r.ok) throw new Error("Could not load " + path + " for the certificates.");
      return new Uint8Array(await r.arrayBuffer());
    };
    const [heavy, bold, regular, semi, mono, jci, qlv] = await Promise.all([
      "vendor/fonts/Poppins-ExtraBold.ttf", "vendor/fonts/Poppins-Bold.ttf", "vendor/fonts/SourceSans3-Regular.ttf",
      "vendor/fonts/SourceSans3-Semibold.ttf", "vendor/fonts/IBMPlexMono-SemiBold.ttf", "assets/jci-aso-white.png", "assets/qlv-white.png",
    ].map(get));
    A = { heavy, bold, regular, semi, mono, jci, qlv };
    return A;
  }

  // Wraps runs of normal and bold words into centred lines no wider than max.
  function layout(runs, fonts, size, max) {
    const words = [];
    runs.forEach((r) => r.t.split(/(\s+)/).forEach((w) => { if (w) words.push({ t: w, b: r.b }); }));
    const width = (w) => (w.b ? fonts.semi : fonts.regular).widthOfTextAtSize(w.t, size);
    const lines = [];
    let line = [], lw = 0;
    for (const w of words) {
      const ww = width(w);
      if (/^\s+$/.test(w.t)) { if (line.length) { line.push(w); lw += ww; } continue; }
      if (line.length && lw + ww > max) {
        while (line.length && /^\s+$/.test(line[line.length - 1].t)) lw -= width(line.pop());
        lines.push({ words: line, w: lw }); line = []; lw = 0;
      }
      line.push(w); lw += ww;
    }
    while (line.length && /^\s+$/.test(line[line.length - 1].t)) lw -= width(line.pop());
    if (line.length) lines.push({ words: line, w: lw });
    return { lines, width };
  }

  function wording(c) {
    const B = (t) => ({ t, b: true }), N = (t) => ({ t, b: false });
    if (c.version === "achievement") {
      const judged = c.place === 1 ? "judged most able" : "judged among the most able";
      return [N("for outstanding work as a member of team "), B(c.table), N(" at "), B("Quality Leadership Value 2026"), N(`, building a plan ${judged} to work without the people who wrote it.`)];
    }
    const base = [N("for taking part in "), B("Quality Leadership Value 2026"), N(", a two-day leadership sprint on the theme "), B("Building Systems That Outlive You")];
    return c.table ? [...base, N(", as a member of team "), B(c.table), N(".")] : [...base, N(".")];
  }

  async function build(c, sigs) {
    const { PDFDocument, rgb, degrees } = window.PDFLib;
    const col = (r, g, b) => rgb(r, g, b);
    const NAVY = col(0.0588, 0.1686, 0.3882), DEEP = col(0.0392, 0.1216, 0.302), INK = col(0.1412, 0.1961, 0.3098), GREY = col(0.2902, 0.3569, 0.4588);
    const YEL = col(0.9373, 0.7608, 0.1765), IVORY = col(0.9843, 0.9804, 0.9647), FAINT = col(0.7059, 0.7608, 0.8392), IDBLUE = col(0.5608, 0.7137, 0.9098), WHITE = col(1, 1, 1);
    const a = A;
    const doc = await PDFDocument.create();
    doc.registerFontkit(window.fontkit);
    doc.setTitle(`QLV 2026 Certificate ${c.id}`);
    doc.setAuthor("JCI Aso, Quality Leadership Value 2026");
    doc.setCreator("QLV 2026");
    const F = {
      heavy: await doc.embedFont(a.heavy, { subset: true }), bold: await doc.embedFont(a.bold, { subset: true }),
      regular: await doc.embedFont(a.regular, { subset: true }), semi: await doc.embedFont(a.semi, { subset: true }), mono: await doc.embedFont(a.mono, { subset: true }),
    };
    const page = doc.addPage([PW, PH]);
    const text = (t, font, px, x, baseline, color, align = "center", opts = {}) => {
      const size = px * K, w = font.widthOfTextAtSize(t, size);
      const left = align === "center" ? X(x) - w / 2 : align === "right" ? X(x) - w : X(x);
      page.drawText(t, { x: left, y: Y(baseline), size, font, color, ...opts });
      return w;
    };
    const rect = (x, y, w, h, color, opacity) => page.drawRectangle({ x: X(x), y: Y(y + h), width: w * K, height: h * K, color, opacity });
    // Letter-spaced capitals, drawn one letter at a time.
    const spaced = (t, font, px, cx, baseline, color, gap) => {
      const size = px * K, g = gap * K;
      const total = [...t].reduce((n, ch) => n + font.widthOfTextAtSize(ch, size), 0) + g * (t.length - 1);
      let x = X(cx) - total / 2;
      for (const ch of t) { page.drawText(ch, { x, y: Y(baseline), size, font, color }); x += font.widthOfTextAtSize(ch, size) + g; }
    };
    const diamond = (cx, cy, half, color) => page.drawSvgPath(`M 0 ${-half} L ${half} 0 L 0 ${half} L ${-half} 0 Z`, { x: X(cx), y: Y(cy), scale: K, color });

    // Ground, border, inner line and corners.
    rect(0, 0, 1123, 794, IVORY);
    page.drawRectangle({ x: X(38), y: Y(38 + 718), width: 1047 * K, height: 718 * K, borderColor: NAVY, borderWidth: 8 * K });
    page.drawRectangle({ x: X(49.5), y: Y(49.5 + 695), width: 1023 * K, height: 695 * K, borderColor: YEL, borderWidth: 1 * K });
    // The band: a gentle deep-to-navy gradient, top to bottom.
    for (let i = 0; i < 83; i++) {
      const t = i / 82, m = (u, v) => u + (v - u) * t;
      rect(49, 49 + i, 1024, 1.2, col(m(0.0392, 0.0588), m(0.1216, 0.1686), m(0.302, 0.3882)));
    }
    for (const [cx, cy] of [[42, 42], [1081, 42], [42, 752], [1081, 752]]) diamond(cx, cy, 24, YEL);
    // Logos, centred, with the thin divider between them.
    const jci = await doc.embedPng(a.jci), qlv = await doc.embedPng(a.qlv);
    page.drawImage(jci, { x: X(457), y: Y(68 + 45), width: 94 * K, height: 45 * K });
    rect(574, 72, 1, 38, col(0.949, 0.9647, 0.9882), 0.45);
    page.drawImage(qlv, { x: X(598), y: Y(70 + 41), width: 67 * K, height: 41 * K });
    text(c.id, F.mono, 9.33, 1029, 93, IDBLUE, "right");

    // Title, rule and name.
    const title = { participation: "Certificate of Participation", achievement: "Certificate of Achievement" }[c.version];
    text(title, F.heavy, 42.66, 561.5, 207, NAVY);
    rect(447, 233.5, 98, 1, NAVY); rect(577, 233.5, 98, 1, NAVY);
    diamond(561, 234, 6.4, YEL);
    text("This is presented to", F.regular, 15.33, 561.5, 285, GREY);
    let namePx = 42.66;
    while (namePx > 24 && F.bold.widthOfTextAtSize(c.name, namePx * K) > 900 * K) namePx -= 1;
    text(c.name, F.bold, namePx, 561.5, 342, NAVY);

    // The place badge, for the top three.
    let bodyTop = 395;
    if (c.version === "achievement") {
      const label = `${["First", "Second", "Third"][c.place - 1]} place · Team ${c.table}`;
      const tw = F.bold.widthOfTextAtSize(label, 14.66 * K) / K;
      const w = 48.8 + tw + 23, left = 561.5 - w / 2;
      page.drawSvgPath(`M 22 0 L ${w - 22} 0 A 22 22 0 0 1 ${w - 22} 44 L 22 44 A 22 22 0 0 1 22 0 Z`, { x: X(left), y: Y(374), scale: K, color: NAVY });
      page.drawCircle({ x: X(left + 22), y: Y(396), size: 15 * K, color: YEL });
      text(String(c.place), F.heavy, 14.66, left + 22, 401, NAVY);
      text(label, F.bold, 14.66, left + 48.8, 401, WHITE, "left");
      bodyTop = 454;
    }
    // The wording, centred, normal and bold runs.
    const size = 16 * K;
    const { lines, width } = layout(wording(c), F, size, 712 * K);
    lines.forEach((ln, i) => {
      let x = X(561.5) - ln.w / 2;
      const base = Y(bodyTop + i * 25);
      for (const w of ln.words) {
        page.drawText(w.t, { x, y: base, size, font: w.b ? F.semi : F.regular, color: w.b ? NAVY : INK });
        x += width(w);
      }
    });
    text("Friday 6 November, virtual · Saturday 7 November, Transcorp Hilton, Abuja", F.regular, 12.66, 561.5, bodyTop + (lines.length - 1) * 25 + 32, GREY);

    // Signatures, each on the line above the name, no taller than the space.
    const blocks = [
      { cx: 275, x0: 91, w: 368, img: sigs && sigs.president, name: "JCIN Amb. Peter Emmanuel Yilbiem", role: "2026 Local Organisation President, JCI Aso" },
      { cx: 847.5, x0: 663, w: 369, img: sigs && sigs.chair, name: "Hadeezah Balarabe Musa", role: "2026 Chairperson, Quality Leadership Value" },
    ];
    for (const b of blocks) {
      if (b.img) {
        const img = await doc.embedPng(b.img);
        const s = Math.min((280 * K) / img.width, (78 * K) / img.height);
        const w = img.width * s, h = img.height * s;
        page.drawImage(img, { x: X(b.cx) - w / 2, y: Y(688), width: w, height: h });
      } else {
        text("signature", F.mono, 9.33, b.cx, 683, FAINT);
      }
      rect(b.x0, 690.5, b.w, 1, NAVY);
      text(b.name, F.bold, 13.33, b.cx, 714, NAVY);
      text(b.role, F.regular, 11.73, b.cx, 732, GREY);
    }
    // The seal.
    page.drawCircle({ x: X(561.5), y: Y(669), size: 64.5 * K, color: YEL });
    page.drawCircle({ x: X(561.5), y: Y(669), size: 57.5 * K, borderColor: DEEP, borderWidth: 0.9 * K, borderOpacity: 0.55, borderDashArray: [2.6 * K, 2.2 * K] });
    spaced("JCI ASO", F.mono, 8.26, 561.5, 643, DEEP, 1.7);
    text("QLV", F.heavy, 20, 561.5, 666, DEEP);
    text("2026", F.heavy, 20, 561.5, 686, DEEP);
    spaced("ABUJA", F.mono, 8.26, 561.5, 701, DEEP, 1.7);
    return doc.save();
  }

  window.QLVCert = { load, build, wording };
})();
