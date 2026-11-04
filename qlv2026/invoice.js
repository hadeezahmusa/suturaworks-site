// QLV 2026 invoice, drawn as a PDF in the browser with pdf-lib.
// Matches QLV-2026-Invoice-Design.pdf: A4 portrait, navy header with the
// white logos, the issuer, "Invoice" in yellow and the number; bill to and
// dates; the event strip; the lines; totals; how to pay; the thank-you line
// and two signature blocks, the Treasurer on the left and the Chairperson on
// the right. No footer. Positions are the design's own, in CSS pixels on a
// 794 by 1123 page. Up to four lines; from three lines on, rows are tighter
// so the page never runs into the signatures.
//
// Used by the admin page: QLVInvoice.load(siteUrl) once (the fonts are the
// certificate's), then QLVInvoice.build(invoice, settings, signatures).
(function () {
  const K = 0.75, PW = 794 * K, PH = 1123 * K;
  const X = (x) => x * K, Y = (y) => PH - y * K;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const day = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const money = (n) => Math.round(n).toLocaleString("en-NG");
  let A = null;

  async function load(site) {
    if (A) return A;
    const get = async (path) => {
      const r = await fetch(site + path);
      if (!r.ok) throw new Error("Could not load " + path + " for the invoice.");
      return new Uint8Array(await r.arrayBuffer());
    };
    const [heavy, bold, regular, semi, mono, jci, qlv] = await Promise.all([
      "vendor/fonts/Poppins-ExtraBold.ttf", "vendor/fonts/Poppins-Bold.ttf", "vendor/fonts/SourceSans3-Regular.ttf",
      "vendor/fonts/SourceSans3-Semibold.ttf", "vendor/fonts/IBMPlexMono-SemiBold.ttf", "assets/jci-aso-white.png", "assets/qlv-white.png",
    ].map(get));
    A = { heavy, bold, regular, semi, mono, jci, qlv };
    return A;
  }

  async function build(inv, s, sigs) {
    const { PDFDocument, rgb, degrees } = window.PDFLib;
    const col = (r, g, b) => rgb(r, g, b);
    const NAVY = col(0.0588, 0.1686, 0.3882), INK = col(0.0549, 0.1059, 0.2), GREY = col(0.2902, 0.3569, 0.4588), YEL = col(0.9373, 0.7608, 0.1765);
    const PALE = col(0.8118, 0.8784, 0.9529), STRIP = col(0.9569, 0.9686, 0.9843), RULE = col(0.8431, 0.8863, 0.9373), CREAM = col(0.9922, 0.9647, 0.8627);
    const TEAL = col(0.1216, 0.4902, 0.5294), WHITE = col(1, 1, 1), RED = col(0.65, 0.12, 0.12);
    const doc = await PDFDocument.create();
    doc.registerFontkit(window.fontkit);
    doc.setTitle(`Invoice ${inv.no} for QLV 2026`);
    doc.setAuthor("Junior Chamber International Aso");
    doc.setCreator("QLV 2026");
    const F = {};
    for (const k of ["heavy", "bold", "regular", "semi", "mono"]) F[k] = await doc.embedFont(A[k], { subset: true });
    const page = doc.addPage([PW, PH]);
    const width = (t, font, px) => font.widthOfTextAtSize(t, px * K) / K;
    const text = (t, font, px, x, baseline, color, align = "left") => {
      const w = width(t, font, px);
      const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
      page.drawText(t, { x: X(left), y: Y(baseline), size: px * K, font, color });
      return w;
    };
    const spaced = (t, font, px, x, baseline, color, gap) => {
      let at = x;
      for (const ch of t) { text(ch, font, px, at, baseline, color); at += width(ch, font, px) + gap; }
    };
    const rect = (x, y, w, h, color, opacity) => page.drawRectangle({ x: X(x), y: Y(y + h), width: w * K, height: h * K, color, opacity });
    const rounded = (x, y, w, h, r, opts) => page.drawSvgPath(`M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`, { x: X(x), y: Y(y), scale: K, ...opts });
    // An amount: the naira sign from Source Sans (Poppins has none), then the figure.
    const naira = (n, font, px, right, baseline, color, signFont) => {
      const digits = money(n), sf = signFont || font;
      const w = width(digits, font, px), sw = width("₦", sf, px);
      text("₦", sf, px, right - w - sw - 0.5, baseline, color);
      text(digits, font, px, right - w, baseline, color);
    };
    const nairaLeft = (n, font, px, left, baseline, color, signFont) => {
      const sw = width("₦", signFont || font, px);
      text("₦", signFont || font, px, left, baseline, color);
      text(money(n), font, px, left + sw + 0.5, baseline, color);
    };

    // Header band, deep to navy.
    for (let i = 0; i < 183; i++) {
      const t = i / 182, m = (u, v) => u + (v - u) * t;
      rect(0, i, 794, 1.2, col(m(0.0392, 0.0588), m(0.1216, 0.1686), m(0.302, 0.3882)));
    }
    page.drawImage(await doc.embedPng(A.jci), { x: X(60), y: Y(38 + 45), width: 94 * K, height: 45 * K });
    rect(173, 42, 2, 37, col(0.949, 0.9647, 0.9882), 0.4);
    page.drawImage(await doc.embedPng(A.qlv), { x: X(194), y: Y(40 + 41), width: 67 * K, height: 41 * K });
    text("Junior Chamber International Aso", F.semi, 12.8, 60.5, 115, WHITE);
    text("Suite B21, Abuja Shopping Mall, Zone 3, Wuse, Abuja", F.regular, 11.73, 60.5, 133, PALE);
    text("+234 703 136 2870 · +234 817 013 8861 · secretariat@jciaso.com", F.regular, 11.73, 60.5, 151, PALE);
    text("Invoice", F.heavy, 40, 734, 72, YEL, "right");
    text(inv.no, F.mono, 13.33, 734, 99, WHITE, "right");

    // Bill to, and the dates.
    spaced("BILL TO", F.mono, 9.33, 60.5, 223, GREY, 2.2);
    text(inv.bill.org, F.bold, 16, 60.5, 249, NAVY);
    const billLines = [];
    if (inv.bill.contact || inv.bill.title) billLines.push("Attn: " + [inv.bill.contact, inv.bill.title].filter(Boolean).join(", "));
    if (inv.bill.address) billLines.push(inv.bill.address);
    const reach = [inv.bill.email, inv.bill.phone].filter(Boolean).join(" · ");
    if (reach) billLines.push(reach);
    billLines.slice(0, 3).forEach((l, i) => text(l, F.regular, 13.6, 60.5, 269 + i * 20, INK));
    [["ISSUE DATE", day(inv.issueDate), 225], ["DUE DATE", day(inv.dueDate), 251], ["INVOICE NO.", inv.no, 276]].forEach(([k, v, b]) => {
      spaced(k, F.mono, 10, 457, b, GREY, 1.6);
      text(v, F.semi, 13.6, 553, b + 2, NAVY);
    });

    // The event strip.
    rounded(60, 332, 673, 70, 7.5, { color: STRIP });
    text("Quality Leadership Value (QLV) 2026", F.bold, 14.66, 79.4, 362, NAVY);
    text("Building Systems That Outlive You", F.regular, 12.8, 79.4, 381, GREY);
    text("Fri 6 Nov, virtual", F.regular, 12.8, 714, 360, GREY, "right");
    text("Sat 7 Nov, Transcorp Hilton, Abuja", F.regular, 12.8, 714, 378, GREY, "right");

    // Lines.
    const lines = inv.lines.slice(0, 4);
    const rowH = lines.length <= 2 ? 63 : 44;
    spaced("DESCRIPTION", F.mono, 9.33, 71.8, 436, GREY, 0.9);
    text("QTY", F.mono, 9.33, 532, 436, GREY, "center");
    text("UNIT PRICE", F.mono, 9.33, 640, 436, GREY, "right");
    text("AMOUNT", F.mono, 9.33, 723, 436, GREY, "right");
    rect(60, 447, 673, 1, NAVY);
    lines.forEach((l, i) => {
      const top = 447 + i * rowH;
      const tb = top + (rowH === 63 ? 27 : 20);
      text(l.title, F.semi, 13.6, 71.8, tb, INK);
      if (l.description) text(l.description, F.regular, rowH === 63 ? 12 : 11, 71.8, tb + (rowH === 63 ? 19 : 15), GREY);
      text(String(l.qty), F.regular, 13.6, 532, tb, INK, "center");
      naira(l.unit, F.regular, 13.6, 640, tb, INK);
      naira(l.amount, F.regular, 13.6, 723, tb, INK);
      rect(60, top + rowH, 673, 1, RULE);
    });
    const shift = 447 + lines.length * rowH - 510;

    // Totals.
    text("Subtotal", F.regular, 13.6, 412, 542 + shift, GREY);
    naira(inv.subtotal, F.regular, 13.6, 733, 542 + shift, INK);
    rect(412, 555 + shift, 205, 1, NAVY); rect(640, 555 + shift, 93, 1, NAVY);
    text("Total due", F.heavy, 20, 412, 587 + shift, NAVY);
    naira(inv.total, F.heavy, 20, 733, 587 + shift, NAVY, F.semi);

    // How to pay.
    rounded(60.5, 612.5 + shift, 672, 188, 9, { borderColor: NAVY, borderWidth: 1 * K });
    text("How to pay", F.bold, 14.66, 84.1, 643 + shift, NAVY);
    const field = (label, value, x, b) => { spaced(label, F.mono, 9.33, x, b + shift, GREY, 0.9); if (value !== null) text(value, F.semi, 14, x, b + 18 + shift, NAVY); };
    field("BANK", s.bankName || "", 84.1, 670);
    field("ACCOUNT NAME", s.accountName || "", 412, 670);
    field("ACCOUNT NUMBER", s.accountNumber || "", 84.1, 715);
    field("AMOUNT", null, 412, 715);
    nairaLeft(inv.total, F.semi, 14, 412, 733 + shift, NAVY);
    rounded(84, 750 + shift, 626, 35, 5.7, { color: CREAM });
    let at = 95.5;
    for (const [t, f] of [["Please use ", F.regular], [inv.no, F.semi], [" as your transfer reference and send the proof of payment to ", F.regular], [s.paymentsEmail || "", F.semi], [".", F.regular]]) {
      at += text(t, f, 12.53, at, 772 + shift, INK);
    }
    text("Thank you for investing in leaders who build to last.", F.bold, 14.66, 60.5, 833 + shift, TEAL);

    // Signatures: Treasurer left, Chairperson right. A missing image leaves the line for signing by hand.
    const blocks = [
      { x0: 60, w: 265, img: sigs && sigs.treasurer, name: s.treasurerName, title: s.treasurerTitle },
      { x0: 469, w: 264, img: sigs && sigs.signatory, name: s.signatoryName, title: s.signatoryTitle },
    ];
    for (const b of blocks) {
      if (b.img) {
        const img = await doc.embedPng(b.img);
        const sc = Math.min((220 * K) / img.width, (64 * K) / img.height);
        page.drawImage(img, { x: X(b.x0 + 4), y: Y(1039), width: img.width * sc, height: img.height * sc });
      }
      rect(b.x0, 1042, b.w, 1, NAVY);
      text(b.name || "", F.bold, 13.33, b.x0 + 0.5, 1062, NAVY);
      text(b.title || "", F.regular, 11.73, b.x0 + 0.5, 1080, GREY);
    }

    // A cancelled invoice says so across the page.
    if (inv.status === "cancelled") {
      const t = "CANCELLED", px = 96, w = width(t, F.heavy, px);
      page.drawText(t, { x: X(397) - (w * K / 2) * Math.cos(Math.PI / 6) + 20, y: Y(600) - (w * K / 2) * Math.sin(Math.PI / 6), size: px * K, font: F.heavy, color: RED, opacity: 0.22, rotate: degrees(30) });
    }
    return doc.save();
  }

  window.QLVInvoice = { load, build, day, money };
})();
