/**
 * Print-ready PDF for a QR sticker batch — one page per sticker, each sized
 * exactly to the physical sticker (2.25 x 4 in, landscape) so the file can
 * go straight to a print vendor. Renders the full branded design (logo,
 * headline, emergency banner, icon row, a big QR code with its id directly
 * underneath, call-out panel) instead of the bare QR-only PNGs the admin
 * "QR codes" viewer produces.
 */
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

// Same brand mark used by both frontends (parking_space_frontend(_admin)/src/lib/config.ts)
// — keep in sync if that URL ever changes. It's a tall pin-badge (505x765px),
// not a wide wordmark, so it's used here as a small icon beside separately
// drawn "AUTO SAHAY" text rather than stretched into a wide logo strip.
const LOGO_URL = 'https://pub-35c378c6c1af4543b728eae61d1261d7.r2.dev/2026/05/App_images/AUTOSAHAY%20png.png';
const LOGO_ASPECT = 505 / 765; // width / height

const PAGE_WIDTH = 4 * 72;     // 288pt (4in)
const PAGE_HEIGHT = 2.25 * 72; // 162pt (2.25in)

const GOLD = '#F0A500';
const GREEN = '#1B7A3D';
const RED = '#E5342B';
const INK = '#161616';
const WHITE = '#FFFFFF';

// ── Layout constants — tuned visually (see stickerPdf design notes below) ──
const LEFT_W = 152;
const SIDEBAR_X = LEFT_W, SIDEBAR_W = 11;
const PANEL_X = SIDEBAR_X + SIDEBAR_W, PANEL_W = PAGE_WIDTH - PANEL_X;

const PILL_Y = 5, PILL_H = 13, PILL_W = 58;
const QR_SIZE = 82;
const QR_Y = PILL_Y + PILL_H + 5;
const ID_Y = QR_Y + QR_SIZE + 4;
const GOLD_H = ID_Y + 9;

const ICON_ROW_Y = 106;
const ICON_R = 10;

// RemixIcon "phone-fill" (Apache-2.0), viewBox 0 0 24 24 — the exact call
// glyph requested, drawn via pdfkit's SVG path support rather than approximated.
const PHONE_ICON_PATH =
  'M21 16.42V19.9561C21 20.4811 20.5941 20.9167 20.0705 20.9537C19.6331 20.9846 19.2763 21 19 21C10.1634 21 3 13.8366 3 5C3 4.72371 3.01545 4.36687 3.04635 3.9295C3.08337 3.40588 3.51894 3 4.04386 3H7.5801C7.83678 3 8.05176 3.19442 8.07753 3.4498C8.10067 3.67907 8.12218 3.86314 8.14207 4.00202C8.34435 5.41472 8.75753 6.75936 9.3487 8.00303C9.44359 8.20265 9.38171 8.44159 9.20185 8.57006L7.04355 10.1118C8.35752 13.1811 10.8189 15.6425 13.8882 16.9565L15.4271 14.8019C15.5572 14.6199 15.799 14.5573 16.001 14.6532C17.2446 15.2439 18.5891 15.6566 20.0016 15.8584C20.1396 15.8782 20.3225 15.8995 20.5502 15.9225C20.8056 15.9483 21 16.1633 21 16.42Z';

export interface StickerPdfItem {
  token: string;
  url: string;
}

let cachedLogo: Buffer | null | undefined; // undefined = not fetched yet, null = fetch failed

const fetchLogo = async (): Promise<Buffer | null> => {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    const res = await fetch(LOGO_URL);
    cachedLogo = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    cachedLogo = null; // design still renders fine without it — just skips the logo image
  }
  return cachedLogo;
};

type IconKind = 'no-parking' | 'emergency' | 'accident' | 'lights';
const ICONS: [IconKind, string][] = [
  ['no-parking', 'No Parking'],
  ['emergency', 'Emergency'],
  ['accident', 'Accident'],
  ['lights', 'Lights On'],
];

/** Small hand-drawn vector icon badges, all built to the same scale — no icon font/asset dependency. */
const drawIcon = (doc: PDFKit.PDFDocument, cx: number, cy: number, kind: IconKind, label: string) => {
  const r = ICON_R;
  switch (kind) {
    case 'no-parking':
      doc.lineWidth(1.6);
      doc.circle(cx, cy, r).fillAndStroke(WHITE, RED);
      doc.moveTo(cx - r * 0.68, cy + r * 0.68).lineTo(cx + r * 0.68, cy - r * 0.68).stroke(RED);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('P', cx - 3, cy - 4.5);
      break;
    case 'emergency':
      doc.circle(cx, cy, r).fill(RED);
      doc.roundedRect(cx - 1, cy - 5, 2, 6, 1).fill(WHITE);
      doc.circle(cx, cy + 4.5, 1.1).fill(WHITE);
      break;
    case 'accident':
      doc.lineJoin('round');
      doc.polygon([cx, cy - r], [cx - r * 0.98, cy + r * 0.82], [cx + r * 0.98, cy + r * 0.82])
        .lineWidth(0.6).fillAndStroke(GOLD, INK);
      doc.roundedRect(cx - 0.9, cy - 2.5, 1.8, 5, 0.9).fill(INK);
      doc.circle(cx, cy + 5, 1).fill(INK);
      break;
    case 'lights': {
      // Headlamp telltale: a lit lamp with beams fanning out — the standard
      // "lights on" dashboard-warning convention.
      doc.lineWidth(1.4);
      doc.circle(cx, cy, r).fillAndStroke('#FDF6E6', GOLD);
      const lampCx = cx + 2.5, lampRx = 3.4, lampRy = 2.6;
      [-22, 0, 22].forEach((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x0 = lampCx - lampRx - 0.5, y0 = cy;
        const len = 6.5;
        doc.moveTo(x0, y0).lineTo(x0 - Math.cos(rad) * len, y0 + Math.sin(rad) * len)
          .lineWidth(1.4).lineCap('round').stroke(GOLD);
      });
      doc.ellipse(lampCx, cy, lampRx, lampRy).fill(INK);
      doc.ellipse(lampCx + 0.6, cy, lampRx * 0.55, lampRy * 0.55).fill('#3A3A3A');
      break;
    }
  }
  doc.font('Helvetica-Bold').fontSize(5.6).fillColor(INK)
    .text(label, cx - 25, cy + r + 5, { width: 50, align: 'center' });
};

/** Vertical (rotated) label along the sticker's inner green sidebar, centered on (cx, cy). */
const drawSidewaysText = (doc: PDFKit.PDFDocument, cx: number, cy: number, text: string) => {
  const fontSize = 5.3;
  doc.save();
  doc.translate(cx, cy);
  doc.rotate(-90);
  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(WHITE);
  const w = doc.widthOfString(text, { characterSpacing: 0.3 });
  doc.text(text, -w / 2, -fontSize / 2, { lineBreak: false, characterSpacing: 0.3 });
  doc.restore();
};

const drawSticker = async (doc: PDFKit.PDFDocument, item: StickerPdfItem, logo: Buffer | null) => {
  const qrPng = await QRCode.toBuffer(item.url, { type: 'png', margin: 1, width: 400 });

  // ── Right side: green sidebar strip + gold call/QR panel + green scan panel ──
  doc.rect(SIDEBAR_X, 0, SIDEBAR_W, PAGE_HEIGHT).fill(GREEN);
  drawSidewaysText(doc, SIDEBAR_X + SIDEBAR_W / 2, PAGE_HEIGHT / 2, 'your number stays private');

  doc.rect(PANEL_X, 0, PANEL_W, GOLD_H).fill(GOLD);
  doc.rect(PANEL_X, GOLD_H, PANEL_W, PAGE_HEIGHT - GOLD_H).fill(GREEN);

  // "call" pill, with the classic phone-handset glyph (RemixIcon "phone-fill") ahead of the label
  const pillX = PANEL_X + (PANEL_W - PILL_W) / 2;
  doc.roundedRect(pillX, PILL_Y, PILL_W, PILL_H, PILL_H / 2).fill(INK);

  doc.font('Helvetica-Bold').fontSize(7);
  const callTextW = doc.widthOfString('CALL', { characterSpacing: 0.5 });
  const iconSize = 6.5, iconGap = 2.5;
  const contentW = iconSize + iconGap + callTextW;
  const contentX = pillX + (PILL_W - contentW) / 2;
  const iconY = PILL_Y + PILL_H / 2 - iconSize / 2;
  const iconScale = iconSize / 24; // glyph's native viewBox is 24x24

  doc.save();
  doc.translate(contentX, iconY);
  doc.scale(iconScale);
  doc.path(PHONE_ICON_PATH).fill(WHITE);
  doc.restore();

  // No `width` box here on purpose — pdfkit's lineBreak:false doesn't reliably
  // stay on one line when paired with a width that exactly matches the
  // measured text, so we just let it flow from its start x instead.
  doc.font('Helvetica-Bold').fontSize(7).fillColor(WHITE)
    .text('CALL', contentX + iconSize + iconGap, PILL_Y + 3.6, { characterSpacing: 0.5, lineBreak: false });

  // QR code — bigger, with its id directly underneath (not at the page's bottom corner)
  const qrX = PANEL_X + (PANEL_W - QR_SIZE) / 2;
  doc.roundedRect(qrX, QR_Y, QR_SIZE, QR_SIZE, 4).fill(WHITE);
  doc.image(qrPng, qrX + 5, QR_Y + 5, { width: QR_SIZE - 10, height: QR_SIZE - 10 });
  doc.font('Courier-Bold').fontSize(6.5).fillColor(INK)
    .text(item.token, PANEL_X, ID_Y, { width: PANEL_W, align: 'center', characterSpacing: 0.4 });

  // Scan instructions + site
  doc.font('Helvetica-Bold').fontSize(6.2).fillColor(WHITE)
    .text('Scan using Google lens, camera or any scanner app.', PANEL_X + 5, GOLD_H + 10, { width: PANEL_W - 10, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
    .text('www.autosahay.com', PANEL_X + 5, GOLD_H + 30, { width: PANEL_W - 10, align: 'center' });

  // ── Left side: logo + brand name, headline, emergency banner, icon + label grid ──
  const logoH = 22, logoW = logoH * LOGO_ASPECT, brandGap = 5;
  doc.font('Helvetica-BoldOblique').fontSize(12);
  const autoW = doc.widthOfString('AUTO ');
  const sahayW = doc.widthOfString('SAHAY');
  const lockupW = (logo ? logoW + brandGap : 0) + autoW + sahayW;
  let lockupX = (LEFT_W - lockupW) / 2;

  if (logo) {
    try {
      doc.image(logo, lockupX, 4, { width: logoW, height: logoH });
    } catch {
      // A corrupt/unexpected logo response shouldn't break sticker generation.
    }
    lockupX += logoW + brandGap;
  }
  const brandY = 4 + logoH * 0.72 - 12 * 0.72; // roughly vertically centered against the icon
  doc.font('Helvetica-BoldOblique').fontSize(12).fillColor(GOLD).text('AUTO ', lockupX, brandY, { lineBreak: false });
  doc.font('Helvetica-BoldOblique').fontSize(12).fillColor(GREEN).text('SAHAY', lockupX + autoW, brandY, { lineBreak: false });

  doc.font('Helvetica-BoldOblique').fontSize(11.5).fillColor(INK)
    .text('SCAN THE QR TO', 6, 33, { width: LEFT_W - 12, align: 'center' });
  doc.font('Helvetica-BoldOblique').fontSize(11.5).fillColor(INK)
    .text('CONTACT OWNER', 6, 48, { width: LEFT_W - 12, align: 'center', underline: true });

  const bannerW = 108, bannerX = (LEFT_W - bannerW) / 2;
  doc.roundedRect(bannerX, 63, bannerW, 15, 7.5).fill(RED);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(WHITE)
    .text('In Case of Emergency', bannerX, 67.5, { width: bannerW, align: 'center' });

  const cellW = LEFT_W / ICONS.length;
  ICONS.forEach(([kind, label], i) => drawIcon(doc, cellW * (i + 0.5), ICON_ROW_Y, kind, label));

  // Bottom accent bar — echoes the two-tone AUTO/SAHAY wordmark, closes the composition.
  doc.rect(0, PAGE_HEIGHT - 4, LEFT_W / 2, 4).fill(GOLD);
  doc.rect(LEFT_W / 2, PAGE_HEIGHT - 4, LEFT_W / 2, 4).fill(GREEN);
};

export const generateStickerBatchPdf = async (items: StickerPdfItem[]): Promise<Buffer> => {
  const logo = await fetchLogo();
  const doc = new PDFDocument({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0, autoFirstPage: false });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  for (const item of items) {
    doc.addPage({ size: [PAGE_WIDTH, PAGE_HEIGHT], margin: 0 });
    // eslint-disable-next-line no-await-in-loop -- pdfkit content must be added in order, page by page
    await drawSticker(doc, item, logo);
  }
  doc.end();

  return done;
};
