import { requireAuth } from "@/lib/auth-session";
import { formatDateTimeID } from "@/lib/date-format";
import { getPaymentProofDataUrl } from "@/lib/payment-proof-assets";
import { isOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";
import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { promises as fsp } from "fs";
import path from "path";

export const runtime = "nodejs";

// ─── Layout ───────────────────────────────────────────────────────────────────
const PW = 595;
const PH = 842;
const MX = 48;
const CW = PW - MX * 2; // 499
const BOTTOM = 790;     // max Y before footer area

// ─── Colors ───────────────────────────────────────────────────────────────────
const C_NAVY    = rgb(0.059, 0.090, 0.165);
const C_MUTED   = rgb(0.392, 0.455, 0.545);
const C_LABEL   = rgb(0.580, 0.635, 0.722);
const C_BORDER  = rgb(0.886, 0.910, 0.941);
const C_ROSE    = rgb(0.882, 0.114, 0.282);
const C_AMBER   = rgb(0.851, 0.467, 0.024);
const C_EMERALD = rgb(0.024, 0.588, 0.416);
const C_TEAL    = rgb(0.051, 0.580, 0.533);
const C_WHITE   = rgb(1, 1, 1);
const C_SLATE50 = rgb(0.973, 0.980, 0.988);
const C_GT_BG   = rgb(0.941, 0.992, 0.984);
const C_GT_BRD  = rgb(0.800, 0.984, 0.941);
const C_BYLINE  = rgb(0.576, 0.588, 0.624);
const C_AMBER50 = rgb(1.000, 0.984, 0.922);
const C_AMBER200= rgb(0.992, 0.906, 0.663);

type C = ReturnType<typeof rgb>;

// ─── Table columns ────────────────────────────────────────────────────────────
const COL_QTY_R = 313;
const COL_HRG_R = 388;
const COL_DSC_R = 453;
const COL_SUB_R = 547;
const COL_PAD   = 6;

// ─── Fonts ────────────────────────────────────────────────────────────────────
type Fonts = { r400: PDFFont; r600: PDFFont; r700: PDFFont; r800: PDFFont };

async function loadFonts(doc: PDFDocument): Promise<Fonts> {
  doc.registerFontkit(fontkit as never);
  const dir = path.join(process.cwd(), "assets/fonts");
  const [b400, b600, b700, b800] = await Promise.all([
    fsp.readFile(path.join(dir, "Inter-Regular.ttf")),
    fsp.readFile(path.join(dir, "Inter-SemiBold.ttf")),
    fsp.readFile(path.join(dir, "Inter-Bold.ttf")),
    fsp.readFile(path.join(dir, "Inter-ExtraBold.ttf")),
  ]);
  const [r400, r600, r700, r800] = await Promise.all([
    doc.embedFont(b400, { subset: true }),
    doc.embedFont(b600, { subset: true }),
    doc.embedFont(b700, { subset: true }),
    doc.embedFont(b800, { subset: true }),
  ]);
  return { r400, r600, r700, r800 };
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

/** Convert top-from-page to pdf-lib baseline Y */
function by(topY: number, font: PDFFont, size: number): number {
  return PH - topY - font.heightAtSize(size, { descender: false });
}

function dt(p: PDFPage, text: string, x: number, topY: number, font: PDFFont, size: number, color: C) {
  p.drawText(text, { x, y: by(topY, font, size), font, size, color });
}

function dtR(p: PDFPage, text: string, rx: number, topY: number, font: PDFFont, size: number, color: C) {
  const w = font.widthOfTextAtSize(text, size);
  dt(p, text, rx - w, topY, font, size, color);
}

function dtSpaced(p: PDFPage, text: string, x: number, topY: number, font: PDFFont, size: number, color: C, sp: number) {
  let cx = x;
  for (const ch of text) {
    dt(p, ch, cx, topY, font, size, color);
    cx += font.widthOfTextAtSize(ch, size) + sp;
  }
}

function tw(text: string, font: PDFFont, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

function dr(p: PDFPage, x: number, topY: number, w: number, h: number, color: C, bc?: C, bw = 0.5) {
  p.drawRectangle({ x, y: PH - topY - h, width: w, height: h, color, ...(bc ? { borderColor: bc, borderWidth: bw } : {}) });
}

function hl(p: PDFPage, x1: number, topY: number, x2: number, color: C, w = 0.5) {
  p.drawLine({ start: { x: x1, y: PH - topY }, end: { x: x2, y: PH - topY }, thickness: w, color });
}

// Pill shape using SVG path (local coords: 0,0 = top-left, Y down in SVG space)
function pill(p: PDFPage, x: number, topY: number, w: number, h: number, color: C) {
  const r = h / 2;
  const path = [
    `M ${r} 0`, `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`, `Z`,
  ].join(" ");
  p.drawSvgPath(path, { x, y: PH - topY, color });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rp(n: number) { return `Rp ${Math.round(n).toLocaleString("id-ID")}`; }
function cut(v: string, max: number) { return v.length > max ? v.slice(0, max - 2) + ".." : v; }

/** Wrap text into lines fitting maxW; truncate to maxLines with ".." on overflow */
function wrapText(text: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) {
      cur = test;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines) {
    // ensure last line fits with ".." if there was overflow
    let last = lines[maxLines - 1];
    const consumed = lines.join(" ").length;
    if (consumed < text.trim().length) {
      while (last.length > 1 && font.widthOfTextAtSize(`${last}..`, size) > maxW) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}..`;
    }
  }
  return lines;
}
function fmtDate(d: Date) { return formatDateTimeID(d); }
function retLabel(r: string) { return RETURN_REASON_LABELS[r as ReturnReason] ?? r; }

function statusColor(s: string): { bg: C; fg: C } {
  if (s === "SUCCESS" || s === "PAID")           return { bg: rgb(0.925, 0.992, 0.961), fg: C_EMERALD };
  if (s === "PENDING" || s === "WAITING_PROOF")  return { bg: rgb(1, 0.984, 0.922),     fg: C_AMBER };
  if (s === "CANCELLED" || s === "FAILED")       return { bg: rgb(1, 0.945, 0.949),     fg: C_ROSE };
  return { bg: rgb(0.957, 0.957, 0.961), fg: C_MUTED };
}

function drawBadge(p: PDFPage, f: Fonts, label: string, x: number, topY: number): number {
  const { bg, fg } = statusColor(label);
  const sz = 8; const padX = 8; const bh = 16;
  const bw = tw(label, f.r700, sz) + padX * 2;
  pill(p, x, topY, bw, bh, bg);
  const txtY = topY + (bh - f.r700.heightAtSize(sz, { descender: false })) / 2;
  dt(p, label, x + padX, txtY, f.r700, sz, fg);
  return bw;
}

// ─── Page header — returns Y after header ─────────────────────────────────────
function drawHeader(
  p: PDFPage, f: Fonts,
  storeName: string, invoiceNumber: string,
  txStatus: string, payStatus: string, hasReturns: boolean,
): number {
  const snSz = 22;
  const snTopY = 36;
  dt(p, cut(storeName, 32), MX, snTopY, f.r800, snSz, C_NAVY);

  const bylineTopY = snTopY + f.r800.heightAtSize(snSz, { descender: false }) + 6;
  dt(p, "by Meijrverse\xb0", MX, bylineTopY, f.r400, 9, C_BYLINE);

  // INVOICE with tracking-widest (2.2pt spacing)
  const invSz = 22; const invSp = 2.2;
  let invTotalW = 0;
  for (const ch of "INVOICE") invTotalW += tw(ch, f.r800, invSz);
  invTotalW += invSp * 6;
  dtSpaced(p, "INVOICE", PW - MX - invTotalW, snTopY, f.r800, invSz, C_TEAL, invSp);
  dtR(p, invoiceNumber, PW - MX, bylineTopY, f.r700, 10, C_NAVY);

  // Badges
  let badgeY = bylineTopY + f.r400.heightAtSize(9, { descender: false }) + 8;
  if (hasReturns) {
    const bw = drawBadge(p, f, "Ada Retur", MX, badgeY);
    void bw;
    badgeY += 22;
  }
  let bx = MX;
  for (const s of [txStatus, payStatus]) {
    bx += drawBadge(p, f, s, bx, badgeY) + 6;
  }

  const divY = badgeY + 22;
  hl(p, MX, divY, PW - MX, C_TEAL, 2);
  return divY + 14;
}

// ─── Page footer ──────────────────────────────────────────────────────────────
function drawFooter(p: PDFPage, f: Fonts, brand: string, num: number, total: number) {
  hl(p, MX, 812, PW - MX, C_BORDER);
  dt(p, brand, MX, 822, f.r400, 7.5, C_MUTED);
  dtR(p, `Halaman ${num} dari ${total}`, PW - MX, 822, f.r400, 7.5, C_MUTED);
}

// ─── Table header row ─────────────────────────────────────────────────────────
function drawTableHeader(p: PDFPage, f: Fonts, y: number) {
  dr(p, MX, y, CW, 26, C_NAVY);
  dt(p, "Item",     MX + 8,          y + 5, f.r700, 8.5, C_WHITE);
  dtR(p, "Qty",      COL_QTY_R - COL_PAD, y + 5, f.r700, 8.5, C_WHITE);
  dtR(p, "Harga",    COL_HRG_R - COL_PAD, y + 5, f.r700, 8.5, C_WHITE);
  dtR(p, "Diskon",   COL_DSC_R - COL_PAD, y + 5, f.r700, 8.5, C_WHITE);
  dtR(p, "Subtotal", COL_SUB_R - COL_PAD, y + 5, f.r700, 8.5, C_WHITE);
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const session = auth.session;

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, ...(session.role === "cashier" ? { cashierId: session.sub } : {}) },
      include: {
        cashier: { select: { name: true, email: true, role: { select: { name: true, slug: true } } } },
        customer: { select: { name: true, phone: true, customerCode: true } },
        cancelledBy: { select: { name: true, email: true } },
        paymentProofUploadedBy: { select: { name: true, email: true } },
        items: {
          select: {
            id: true, qty: true, price: true, subtotal: true,
            discountType: true, discountValue: true,
            discountAmount: true, discountReason: true,
            subtotalBeforeDiscount: true,
            product: { select: { name: true, sku: true } },
          },
          orderBy: { id: "asc" },
        },
        returns: {
          where: { returnType: "CUSTOMER_RETURN" },
          include: {
            items: { include: { product: { select: { name: true, sku: true } } }, orderBy: { createdAt: "asc" } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    getSettings(),
  ]);

  if (!sale) return NextResponse.json({ message: "Invoice tidak ditemukan." }, { status: 404 });

  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { code: sale.paymentMethod }, select: { name: true },
  });

  const mn = (v: unknown) => Math.round(Number(v ?? 0));
  const totalQty              = sale.items.reduce((a, i) => a + i.qty, 0);
  const totalItemDiscount     = sale.items.reduce((a, i) => a + mn(i.discountAmount), 0);
  const subtotalBeforeDiscount = sale.items.reduce((a, i) => {
    const s = mn(i.subtotalBeforeDiscount);
    return a + (s > 0 ? s : i.price * i.qty);
  }, 0);
  const subtotalBeforeLoyalty =
    sale.subtotalBeforeLoyalty > 0
      ? sale.subtotalBeforeLoyalty
      : Math.max(subtotalBeforeDiscount - totalItemDiscount, 0);
  const changeAmount = Math.max(sale.paidAmount - sale.subtotal, 0);
  const totalReturn  = sale.returns.reduce((a, r) => a + (r.totalRefund ?? 0), 0);

  const storeName   = settings.storeName || "Toko Pancing";
  const storeWa     = settings.storeWhatsApp.trim();
  const cashierName = sale.cashier.name?.trim() || "Operator";
  const paymentName = paymentMethod?.name ?? sale.paymentMethod;
  const custName    = sale.customer?.name ?? "Walk-in Customer";
  const custSub     = sale.customer
    ? `${sale.customer.customerCode}${sale.customer.phone ? " \xb7 " + sale.customer.phone : ""}`
    : "";

  // ── Build PDF ────────────────────────────────────────────────────────────────
  const doc = await PDFDocument.create();
  const f   = await loadFonts(doc);
  const allPages: PDFPage[] = [];

  // ── Payment proof image (jpeg/png only — matches upload restriction) ──────────
  let proofImage: PDFImage | null = null;
  if (sale.paymentProofUrl) {
    const proofDataUrl = await getPaymentProofDataUrl(sale.id);
    const m = proofDataUrl.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    if (m) {
      const bytes = Buffer.from(m[2], "base64");
      proofImage = m[1] === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    }
  }
  const canViewProofAudit = isOwnerRole(session.role);

  // sale is confirmed non-null (early return above)
  function newPage(): [PDFPage, number] {
    const p = doc.addPage([PW, PH]);
    allPages.push(p);
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const confirmed = sale!;
    const startY = drawHeader(p, f, storeName, confirmed.invoiceNumber,
      String(confirmed.transactionStatus), String(confirmed.paymentStatus),
      confirmed.returns.length > 0);
    return [p, startY];
  }

  let [page, y] = newPage();

  // ── Info grid ────────────────────────────────────────────────────────────────
  const LBL = 9; const VAL = 11;

  dt(page, "Tanggal Transaksi", MX,  y, f.r400, LBL, C_LABEL);
  dt(page, "Payment Method",   305,  y, f.r400, LBL, C_LABEL);
  y += f.r400.heightAtSize(LBL, { descender: false }) + 5;
  dt(page, fmtDate(sale.createdAt),    MX,  y, f.r600, VAL, C_NAVY);
  dt(page, cut(paymentName, 26),       305, y, f.r600, VAL, C_NAVY);
  y += f.r600.heightAtSize(VAL, { descender: false }) + 14;

  dt(page, "Payment Status", MX,  y, f.r400, LBL, C_LABEL);
  dt(page, "Operator",       305, y, f.r400, LBL, C_LABEL);
  y += f.r400.heightAtSize(LBL, { descender: false }) + 5;
  let pbx = MX;
  for (const s of [String(sale.paymentStatus), String(sale.transactionStatus)]) {
    pbx += drawBadge(page, f, s, pbx, y) + 6;
  }
  dt(page, cut(cashierName, 26), 305, y, f.r600, VAL, C_NAVY);
  y += 16 + 12;

  dt(page, "Customer", MX, y, f.r400, LBL, C_LABEL);
  y += f.r400.heightAtSize(LBL, { descender: false }) + 5;
  dt(page, cut(custName, 34), MX, y, f.r600, VAL, C_NAVY);
  y += f.r600.heightAtSize(VAL, { descender: false }) + 4;
  if (custSub) {
    dt(page, cut(custSub, 54), MX, y, f.r400, 8.5, C_LABEL);
    y += f.r400.heightAtSize(8.5, { descender: false }) + 4;
  }
  y += 10;

  // ── Cancelled block ──────────────────────────────────────────────────────────
  if (sale.transactionStatus === "CANCELLED") {
    hl(page, MX, y, PW - MX, C_BORDER);
    y += 14;
    dt(page, "Transaksi Dibatalkan", MX, y, f.r700, 11, C_ROSE);
    y += f.r700.heightAtSize(11, { descender: false }) + 10;

    const hw = (CW - 8) / 2;
    dr(page, MX,        y, hw, 34, rgb(1, 0.945, 0.949), rgb(0.996, 0.784, 0.788));
    dt(page, "Alasan",                MX + 8, y + 6,  f.r400, 8, rgb(0.957, 0.247, 0.369));
    dt(page, cut(sale.cancelReason ?? "-", 28), MX + 8, y + 18, f.r600, 9, rgb(0.624, 0.071, 0.220));
    dr(page, MX + hw + 8, y, hw, 34, C_WHITE, C_BORDER);
    dt(page, "Dibatalkan Pada",       MX + hw + 16, y + 6,  f.r400, 8, C_MUTED);
    dt(page, sale.cancelledAt ? fmtDate(sale.cancelledAt) : "-", MX + hw + 16, y + 18, f.r600, 9, C_NAVY);
    y += 42;

    dr(page, MX, y, CW, 30, C_WHITE, C_BORDER);
    dt(page, "Dibatalkan Oleh", MX + 8, y + 6,  f.r400, 8, C_MUTED);
    dt(page, cut(sale.cancelledBy?.name ?? "-", 40), MX + 8, y + 18, f.r600, 9, C_NAVY);
    y += 38;
  }

  // ── Payment proof section ─────────────────────────────────────────────────────
  if (proofImage) {
    const maxW = 150, maxH = 150;
    const dim = proofImage.scale(1);
    const scale = Math.min(maxW / dim.width, maxH / dim.height, 1);
    const iw = dim.width * scale;
    const ih = dim.height * scale;

    const titleH = f.r700.heightAtSize(11, { descender: false });
    const metaX = MX + iw + 16;
    const metaW = PW - MX - metaX;
    const bodyH = Math.max(ih, 90);

    if (y + 14 + titleH + 10 + bodyH + 10 > BOTTOM) { [page, y] = newPage(); }

    hl(page, MX, y, PW - MX, C_BORDER);
    y += 14;
    dt(page, "Bukti Pembayaran QRIS", MX, y, f.r700, 11, C_NAVY);
    y += titleH + 10;

    const imgTop = y;
    page.drawImage(proofImage, { x: MX, y: PH - imgTop - ih, width: iw, height: ih });

    let my = y;
    const rowH = 26;
    const drawMetaRow = (label: string, value: string) => {
      dr(page, metaX, my, metaW, rowH, C_WHITE, C_BORDER);
      dt(page, label, metaX + 8, my + 4,  f.r400, 7.5, C_MUTED);
      dt(page, cut(value, 46), metaX + 8, my + 15, f.r600, 8.5, C_NAVY);
      my += rowH + 6;
    };
    if (canViewProofAudit) {
      drawMetaRow("Uploaded At", sale.paymentProofUploadedAt ? fmtDate(sale.paymentProofUploadedAt) : "-");
      drawMetaRow("Uploaded By", sale.paymentProofUploadedBy?.name ?? "-");
    }

    y = Math.max(imgTop + ih, my) + 10;
  }

  // ── Items table ──────────────────────────────────────────────────────────────
  hl(page, MX, y, PW - MX, C_BORDER);
  y += 10;
  drawTableHeader(page, f, y);
  y += 26;

  let alt = false;
  for (const item of sale.items) {
    const discAmt   = mn(item.discountAmount);
    const hasDisc   = discAmt > 0;
    const hasReason = hasDisc && (item.discountReason ?? "").trim().length > 0;
    const rowH      = hasDisc ? (hasReason ? 54 : 42) : 32;

    if (y + rowH > BOTTOM) {
      [page, y] = newPage();
      drawTableHeader(page, f, y);
      y += 26;
      alt = false;
    }

    const bg = alt ? C_SLATE50 : C_WHITE;
    dr(page, MX, y, CW, rowH, bg, C_BORDER);

    const qtyStr  = String(item.qty);
    const prcStr  = rp(item.price);
    const subStr  = rp(item.subtotal);
    const typeLbl = item.discountType === "PERCENT"
      ? `${mn(item.discountValue)}%`
      : item.discountType === "FIXED" ? "Nominal" : "";

    dt(page,  cut(item.product.name, 32), MX + 6,          y + 6,  f.r700, 9,   C_NAVY);
    dt(page,  cut(item.product.sku ?? "-", 30), MX + 6,    y + 19, f.r400, 7.5, C_LABEL);
    dtR(page, qtyStr,   COL_QTY_R - COL_PAD, y + 6,  f.r400, 9, C_NAVY);
    dtR(page, prcStr,   COL_HRG_R - COL_PAD, y + 6,  f.r400, 9, C_NAVY);
    dtR(page, subStr,   COL_SUB_R - COL_PAD, y + 6,  f.r700, 9, C_NAVY);

    if (hasDisc) {
      const dStr = `-${rp(discAmt)}`;
      dtR(page, dStr,    COL_DSC_R - COL_PAD, y + 6,  f.r600, 9, C_ROSE);
      dtR(page, typeLbl, COL_DSC_R - COL_PAD, y + 19, f.r400, 8, C_MUTED);
      if (hasReason) dt(page, cut(item.discountReason ?? "", 30), MX + 6, y + 36, f.r400, 7.5, C_MUTED);
    } else {
      dtR(page, "-", COL_DSC_R - COL_PAD, y + 6, f.r400, 9, C_MUTED);
    }

    y += rowH;
    alt = !alt;
  }

  // ── Totals ───────────────────────────────────────────────────────────────────
  if (y + 160 > BOTTOM) {
    [page, y] = newPage();
  }

  y += 14;
  hl(page, MX, y, PW - MX, C_BORDER);
  y += 20;

  const TOT_SZ = 9.5;
  const TOT_LX = 300;

  function totLine(label: string, val: string, bold = false, valColor: C = C_NAVY) {
    const lFont = bold ? f.r700 : f.r400;
    const vFont = bold ? f.r700 : f.r400;
    dt(page,  label, TOT_LX,    y, lFont, TOT_SZ, bold ? C_NAVY : C_MUTED);
    dtR(page, val,   COL_SUB_R, y, vFont, TOT_SZ, valColor);
    y += f.r400.heightAtSize(TOT_SZ, { descender: false }) + 9;
  }

  totLine("Total Qty",           String(totalQty));
  totLine("Subtotal",            rp(subtotalBeforeDiscount));
  totLine("Total Diskon Grosir", `-${rp(totalItemDiscount)}`, false, C_ROSE);

  if (sale.loyaltyApplied) {
    totLine("Subtotal Sebelum Loyalty", rp(subtotalBeforeLoyalty));
    const loyLbl = `Diskon Loyalty${sale.loyaltyMilestone ? ` (ke-${sale.loyaltyMilestone})` : ""}`;
    totLine(loyLbl, `-${rp(sale.loyaltyDiscountAmount)}`, false, C_ROSE);
    if (sale.loyaltyBenefitNote) {
      const note = `Catatan Loyalty: ${cut(sale.loyaltyBenefitNote, 50)}`;
      dr(page, TOT_LX, y, CW - (TOT_LX - MX), 22, C_AMBER50, C_AMBER200);
      dt(page, note, TOT_LX + 6, y + 4, f.r400, 8, rgb(0.471, 0.208, 0.059));
      y += 28;
    }
  }

  if (sale.returns.length > 0) totLine("Total Retur", `-${rp(totalReturn)}`, false, C_ROSE);

  // Grand Total
  hl(page, TOT_LX, y + 4, PW - MX, C_GT_BRD);
  y += 8;
  const gtH = 28;
  dr(page, TOT_LX - 2, y, CW - (TOT_LX - MX) + 2, gtH, C_GT_BG);
  hl(page, TOT_LX - 2, y,       PW - MX, C_GT_BRD);
  hl(page, TOT_LX - 2, y + gtH, PW - MX, C_GT_BRD);
  const gtSz = 11;
  const gtTxtY = y + (gtH - f.r800.heightAtSize(gtSz, { descender: false })) / 2;
  dt(page,  "Grand Total",    TOT_LX + 6, gtTxtY, f.r800, gtSz, C_NAVY);
  dtR(page, rp(sale.subtotal), COL_SUB_R - 4, gtTxtY, f.r800, gtSz, C_NAVY);
  y += gtH + 8;

  totLine("Dibayar", rp(sale.paidAmount));
  totLine("Kembali", rp(changeAmount));

  // ── Returns section ──────────────────────────────────────────────────────────
  if (sale.returns.length > 0) {
    y += 10;
    if (y + 80 > BOTTOM) { [page, y] = newPage(); }
    hl(page, MX, y, PW - MX, C_BORDER);
    y += 14;
    dt(page, "Item Retur", MX, y, f.r700, 11, C_NAVY);
    y += f.r700.heightAtSize(11, { descender: false }) + 8;

    // Columns: Tanggal | Item | Qty(R) | Nilai(R) | Alasan
    const RET_DATE_X = MX + 6;        // 54
    const RET_ITEM_X = 148;
    const RET_QTY_R  = 318;           // right edge for Qty
    const RET_VAL_R  = 408;           // right edge for Nilai
    const RET_RSN_X  = 420;           // Alasan start
    const RET_RSN_W  = PW - MX - RET_RSN_X; // 127

    dt(page, "Tanggal", RET_DATE_X,         y, f.r400, 8.5, C_MUTED);
    dt(page, "Item",    RET_ITEM_X,         y, f.r400, 8.5, C_MUTED);
    dtR(page, "Qty",    RET_QTY_R,          y, f.r400, 8.5, C_MUTED);
    dtR(page, "Nilai",  RET_VAL_R,          y, f.r400, 8.5, C_MUTED);
    dt(page, "Alasan",  RET_RSN_X,          y, f.r400, 8.5, C_MUTED);
    y += f.r400.heightAtSize(8.5, { descender: false }) + 6;
    hl(page, MX, y, PW - MX, C_BORDER);
    y += 4;

    for (const sr of sale.returns) {
      for (const ri of sr.items) {
        const reasonFull = retLabel(sr.reason) + (sr.notes ? ` ${sr.notes}` : "");
        const reasonLines = wrapText(reasonFull, f.r400, 8, RET_RSN_W, 2);
        const rowH = Math.max(28, 10 + reasonLines.length * 11);

        if (y + rowH + 4 > BOTTOM) { [page, y] = newPage(); }
        dr(page, MX, y, CW, rowH, rgb(1, 0.945, 0.949), C_BORDER);
        dt(page, cut(fmtDate(sr.createdAt), 18), RET_DATE_X, y + 5,  f.r400, 8,   C_MUTED);
        dt(page, cut(ri.product.name, 26),       RET_ITEM_X, y + 5,  f.r700, 9,   C_NAVY);
        dt(page, ri.product.sku ?? "-",          RET_ITEM_X, y + 18, f.r400, 7.5, C_MUTED);
        dtR(page, String(ri.qty),                RET_QTY_R,  y + 5,  f.r400, 8.5, C_NAVY);
        dtR(page, rp(ri.subtotal),               RET_VAL_R,  y + 5,  f.r400, 8.5, C_ROSE);
        reasonLines.forEach((line, li) => {
          dt(page, line, RET_RSN_X, y + 5 + li * 11, f.r400, 8, C_NAVY);
        });
        y += rowH;
      }
    }
  }

  // ── Closing footer text ───────────────────────────────────────────────────────
  y += 18;
  if (y + 40 > BOTTOM) { [page, y] = newPage(); }
  hl(page, MX, y, PW - MX, C_BORDER);
  y += 14;
  dt(page, "Terima kasih sudah berbelanja.", MX, y, f.r700, 11, C_TEAL);
  if (storeWa) {
    y += f.r700.heightAtSize(11, { descender: false }) + 6;
    dt(page, `Hubungi kami: wa.me/${storeWa}`, MX, y, f.r400, 9, C_LABEL);
  }

  // ── Write footers with real page count ────────────────────────────────────────
  const total = allPages.length;
  const brand = `${storeName} by MeijrVerse\xb0`;
  for (let i = 0; i < allPages.length; i++) {
    drawFooter(allPages[i], f, brand, i + 1, total);
  }

  const pdfBytes = await doc.save();
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${sale.invoiceNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
