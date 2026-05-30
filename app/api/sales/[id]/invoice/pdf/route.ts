import { requireAuth } from "@/lib/auth-session";
import { formatDateTimeID } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import { operatorLabel } from "@/lib/transaction-identity";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// ─── Page & layout ────────────────────────────────────────────────────────────
const PW  = 595;
const PH  = 842;
const MX  = 48;          // margin x
const CW  = PW - MX * 2; // content width = 499

// ─── Palette ──────────────────────────────────────────────────────────────────
const NAVY    = "#0F172A";
const MUTED   = "#64748B";
const BORDER  = "#E2E8F0";
const ROSE    = "#E11D48";
const AMBER   = "#D97706";
const EMERALD = "#059669";

// ─── PDF primitives ───────────────────────────────────────────────────────────

function esc(v: string) {
  return v
    .replace(/[^\x20-\x7E]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function rgb(hex: string) {
  const h = hex.replace("#", "");
  return [
    (parseInt(h.slice(0, 2), 16) / 255).toFixed(3),
    (parseInt(h.slice(2, 4), 16) / 255).toFixed(3),
    (parseInt(h.slice(4, 6), 16) / 255).toFixed(3),
  ].join(" ");
}

function txt(value: string, x: number, y: number, size = 10, bold = false, fill = NAVY) {
  const font = bold ? "F2" : "F1";
  return [
    "BT",
    `/${font} ${size} Tf`,
    `${rgb(fill)} rg`,
    `${x} ${PH - y} Td`,
    `(${esc(value)}) Tj`,
    "ET",
  ].join("\n");
}

function box(x: number, y: number, w: number, h: number, fill: string, stroke?: string) {
  const yy = PH - y - h;
  if (!stroke) return `${rgb(fill)} rg\n${x} ${yy} ${w} ${h} re f`;
  return [
    `${rgb(fill)} rg`,
    `${rgb(stroke)} RG`,
    "0.5 w",
    `${x} ${yy} ${w} ${h} re B`,
  ].join("\n");
}

function hline(x1: number, y: number, x2: number, stroke = BORDER) {
  return `${rgb(stroke)} RG\n0.5 w\n${x1} ${PH - y} m\n${x2} ${PH - y} l\nS`;
}

function cut(v: string, max: number) {
  return v.length > max ? v.slice(0, max - 2) + ".." : v;
}

function rp(n: number) {
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

function fmtDate(d: Date) { return formatDateTimeID(d); }

function returnLabel(reason: string) {
  return RETURN_REASON_LABELS[reason as ReturnReason] ?? reason;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusColors(status: string): { bg: string; fg: string } {
  if (status === "SUCCESS" || status === "PAID")   return { bg: "#ECFDF5", fg: EMERALD };
  if (status === "PENDING" || status === "WAITING_PROOF") return { bg: "#FFFBEB", fg: AMBER };
  if (status === "CANCELLED" || status === "FAILED")      return { bg: "#FFF1F2", fg: ROSE };
  return { bg: "#F4F4F5", fg: MUTED };
}

function statusBadge(label: string, x: number, y: number): { content: string; width: number } {
  const { bg, fg } = statusColors(label);
  const cw  = 5.8;  // approx char width at 8pt Helvetica
  const pad = 8;
  const bw  = label.length * cw + pad * 2;
  const bh  = 16;
  return {
    content: [
      box(x, y - 12, bw, bh, bg),
      txt(label, x + pad, y, 8, true, fg),
    ].join("\n"),
    width: bw,
  };
}

// ─── Label + value pair (info grid) ──────────────────────────────────────────

function labelVal(label: string, value: string, x: number, y: number, maxVal = 28) {
  return [
    txt(label, x, y, 8.5, false, MUTED),
    txt(cut(value, maxVal), x, y + 15, 10, true, NAVY),
  ].join("\n");
}

// ─── Totals row ───────────────────────────────────────────────────────────────

const TOT_LX = 300;   // label start x for totals block
const TOT_RX = PW - MX; // right edge = 547

function totalLine(label: string, value: string, y: number, bold = false, valueColor = NAVY) {
  // right-align value: approximate char width at 10pt ≈ 5.5 px
  const valX = TOT_RX - value.length * 5.5;
  return [
    txt(label, TOT_LX, y, 9.5, bold, bold ? NAVY : MUTED),
    txt(value, valX, y, 9.5, bold, valueColor),
  ].join("\n");
}

// ─── Item table ───────────────────────────────────────────────────────────────
//  Columns: Item(MX..310) | Qty(310..355) | Harga(355..430) | Diskon(430..490) | Subtotal(490..547)

// Column right edges (sum = CW = 499):
//   Item 220pt → x 48–268   Qty 45pt → 268–313
//   Harga 75pt → 313–388    Diskon 65pt → 388–453
//   Subtotal 94pt → 453–547
const COL_QTY_R  = 313;
const COL_HRG_R  = 388;
const COL_DSC_R  = 453;
const COL_SUB_R  = 547; // = PW - MX
const COL_PAD    = 6;   // right padding inside each column so text never touches border

// Right-align helper: anchor to (colRight - COL_PAD), char width ~5pt at 8-9pt Helvetica
function rax(text: string, colRight: number, charW = 5.0) {
  return colRight - COL_PAD - text.length * charW;
}

function itemTableHeader(y: number) {
  return [
    box(MX, y, CW, 24, NAVY),
    txt("Item",     MX + 6,                    y + 16, 8.5, true, "#FFFFFF"),
    txt("Qty",      rax("Qty",      COL_QTY_R, 4.8), y + 16, 8.5, true, "#FFFFFF"),
    txt("Harga",    rax("Harga",    COL_HRG_R, 4.8), y + 16, 8.5, true, "#FFFFFF"),
    txt("Diskon",   rax("Diskon",   COL_DSC_R, 4.8), y + 16, 8.5, true, "#FFFFFF"),
    txt("Subtotal", rax("Subtotal", COL_SUB_R, 4.8), y + 16, 8.5, true, "#FFFFFF"),
  ].join("\n");
}

type RowResult = { content: string; height: number };

function itemRow(
  y: number,
  name: string,
  sku: string,
  qty: number,
  price: number,
  subtotal: number,
  discountAmount: number,
  discountTypeLabel: string,
  discountReason: string,
  alt: boolean,
): RowResult {
  const hasDisc   = discountAmount > 0;
  const hasReason = hasDisc && discountReason.trim().length > 0;
  const rowH      = hasDisc ? (hasReason ? 54 : 42) : 32;
  const fillBg    = alt ? "#F8FAFC" : "#FFFFFF";

  const qtyStr  = String(qty);
  const priceStr = rp(price);
  const subStr   = rp(subtotal);

  const parts: string[] = [
    box(MX, y, CW, rowH, fillBg, BORDER),
    txt(cut(name, 28),       MX + 6,                    y + 18, 9,   true,  NAVY),
    txt(cut(sku || "-", 20), MX + 6,                    y + 30, 7.5, false, MUTED),
    txt(qtyStr,   rax(qtyStr,   COL_QTY_R),             y + 18, 9,   false, NAVY),
    txt(priceStr, rax(priceStr, COL_HRG_R),             y + 18, 9,   false, NAVY),
    txt(subStr,   rax(subStr,   COL_SUB_R),             y + 18, 9,   true,  NAVY),
  ];

  if (hasDisc) {
    const discStr = `-${rp(discountAmount)}`;
    parts.push(
      txt(discStr,           rax(discStr,           COL_DSC_R), y + 18, 9, false, ROSE),
      txt(discountTypeLabel, rax(discountTypeLabel, COL_DSC_R), y + 30, 8, false, MUTED),
    );
    if (hasReason) {
      parts.push(txt(cut(discountReason, 24), MX + 6, y + 44, 7.5, false, MUTED));
    }
  } else {
    parts.push(txt("-", rax("-", COL_DSC_R), y + 18, 9, false, MUTED));
  }

  return { content: parts.join("\n"), height: rowH };
}

// ─── Returns table ────────────────────────────────────────────────────────────

function returnTableHeader(y: number) {
  return [
    box(MX, y, CW, 22, "#374151"),
    txt("Tanggal", MX + 6, y + 14, 8.5, true, "#FFFFFF"),
    txt("Item",    170,    y + 14, 8.5, true, "#FFFFFF"),
    txt("Qty",     370,    y + 14, 8.5, true, "#FFFFFF"),
    txt("Nilai",   415,    y + 14, 8.5, true, "#FFFFFF"),
    txt("Alasan",  480,    y + 14, 8.5, true, "#FFFFFF"),
  ].join("\n");
}

// ─── Page footer ──────────────────────────────────────────────────────────────

function pageFooter(page: number, total: number) {
  return [
    hline(MX, 812, PW - MX),
    txt("Generated by Fishing POS", MX, 828, 7.5, false, MUTED),
    txt(`Halaman ${page} dari ${total}`, PW - MX - 80, 828, 7.5, false, MUTED),
  ].join("\n");
}

// ─── PDF assembly ─────────────────────────────────────────────────────────────

function buildPdf(pages: string[]): Buffer {
  const objs = pages.flatMap((content, i) => {
    const pn = 5 + i * 2;
    const cn = pn + 1;
    return [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${cn} 0 R >>`,
      `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
    ];
  });
  const kids    = pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  const catalog = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    ...objs,
  ];
  let pdf = "%PDF-1.4\n";
  const offs: number[] = [];
  catalog.forEach((o, i) => {
    offs.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${catalog.length + 1}\n0000000000 65535 f \n`;
  offs.forEach(o => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${catalog.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const { id }  = await params;
  const session = auth.session;

  const sale = await prisma.sale.findFirst({
    where: {
      id,
      ...(session.role === "cashier" ? { cashierId: session.sub } : {}),
    },
    include: {
      cashier: {
        select: {
          name: true,
          email: true,
          role: { select: { name: true, slug: true } },
        },
      },
      customer: {
        select: { name: true, phone: true, customerCode: true },
      },
      cancelledBy: {
        select: { name: true, email: true },
      },
      items: {
        select: {
          id: true,
          qty: true,
          price: true,
          subtotal: true,
          discountType: true,
          discountValue: true,
          discountAmount: true,
          discountReason: true,
          subtotalBeforeDiscount: true,
          product: { select: { name: true, sku: true } },
        },
        orderBy: { id: "asc" },
      },
      returns: {
        where: { returnType: "CUSTOMER_RETURN" },
        include: {
          items: {
            include: { product: { select: { name: true, sku: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ message: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const confirmedSale = sale;

  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: { code: sale.paymentMethod },
    select: { name: true },
  });

  // ── Computed values ────────────────────────────────────────────────────────
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

  const cashierName  = operatorLabel(sale.cashier);
  const paymentName  = paymentMethod?.name ?? sale.paymentMethod;
  const customerName = sale.customer?.name ?? "Walk-in Customer";
  const customerSub  = sale.customer
    ? `${sale.customer.customerCode}${sale.customer.phone ? " - " + sale.customer.phone : ""}`
    : "";

  // ── Page rendering ─────────────────────────────────────────────────────────
  const pages: string[][] = [];

  function newPage() {
    const pg: string[] = [];

    // "Fishing POS" label
    pg.push(txt("Fishing POS", MX, 48, 9, false, MUTED));

    // "Invoice" heading (large)
    pg.push(txt("Invoice", MX, 76, 24, true, NAVY));

    // Status badges — left side below heading
    let badgeY = 100;
    if (confirmedSale.returns.length > 0) {
      const retW = "Ada Retur".length * 5.8 + 16;
      pg.push(box(MX, badgeY - 13, retW, 17, "#FFF1F2"));
      pg.push(txt("Ada Retur", MX + 8, badgeY, 8, true, ROSE));
      badgeY = 120;
    }
    let bx = MX;
    for (const status of [confirmedSale.transactionStatus, confirmedSale.paymentStatus]) {
      const b = statusBadge(String(status), bx, badgeY);
      pg.push(b.content);
      bx += b.width + 6;
    }

    // Invoice number — right-aligned to right margin
    const invNumW   = confirmedSale.invoiceNumber.length * 5.5;
    const invLabelW = "Invoice Number".length * 4.8;
    pg.push(txt("Invoice Number",          PW - MX - invLabelW, 48, 8.5, false, MUTED));
    pg.push(txt(confirmedSale.invoiceNumber, PW - MX - invNumW, 66, 10,  true,  NAVY));

    // Divider below header
    pg.push(hline(MX, 118, PW - MX, "#CBD5E1"));

    pages.push(pg);
  }

  newPage();
  let y = 136;

  // ── Info grid (2 columns) ────────────────────────────────────────────────
  // Row 1: Tanggal | Payment Method
  pages[pages.length - 1].push(
    labelVal("Tanggal Transaksi", fmtDate(sale.createdAt), MX, y, 30),
    labelVal("Payment Method", cut(paymentName, 26), 305, y, 26),
  );
  y += 40;

  // Row 2: Payment Status (badges) | Operator
  pages[pages.length - 1].push(
    txt("Payment Status", MX, y, 8.5, false, MUTED),
    txt("Operator",       305, y, 8.5, false, MUTED),
  );
  y += 14;
  let pbx = MX;
  for (const status of [sale.paymentStatus, sale.transactionStatus]) {
    const b = statusBadge(String(status), pbx, y);
    pages[pages.length - 1].push(b.content);
    pbx += b.width + 6;
  }
  pages[pages.length - 1].push(
    txt(cut(cashierName, 26), 305, y, 10, true, NAVY),
    txt(cut(sale.cashier.email, 30), 305, y + 14, 8, false, MUTED),
  );
  y += 32;

  // Row 3: Customer
  pages[pages.length - 1].push(
    txt("Customer", MX, y, 8.5, false, MUTED),
    txt(cut(customerName, 30), MX, y + 15, 10, true, NAVY),
  );
  if (customerSub) {
    pages[pages.length - 1].push(txt(cut(customerSub, 40), MX, y + 29, 8, false, MUTED));
    y += 14;
  }
  y += 36;

  // ── Cancelled block ──────────────────────────────────────────────────────
  if (sale.transactionStatus === "CANCELLED") {
    pages[pages.length - 1].push(hline(MX, y, PW - MX));
    y += 16;
    pages[pages.length - 1].push(txt("Transaksi Dibatalkan", MX, y, 11, true, ROSE));
    y += 18;
    pages[pages.length - 1].push(
      box(MX, y - 2, 235, 34, "#FFF1F2", "#FECACA"),
      txt("Alasan", MX + 8, y + 11, 8, false, "#F43F5E"),
      txt(cut(sale.cancelReason ?? "-", 30), MX + 8, y + 24, 9, true, "#9F1239"),
      box(MX + 243, y - 2, 256, 34, "#FFFFFF", BORDER),
      txt("Dibatalkan Pada", MX + 251, y + 11, 8, false, MUTED),
      txt(sale.cancelledAt ? fmtDate(sale.cancelledAt) : "-", MX + 251, y + 24, 9, true, NAVY),
    );
    y += 42;
    pages[pages.length - 1].push(
      box(MX, y - 2, CW, 30, "#FFFFFF", BORDER),
      txt("Dibatalkan Oleh", MX + 8, y + 11, 8, false, MUTED),
      txt(cut(sale.cancelledBy?.name ?? "-", 40), MX + 8, y + 23, 9, true, NAVY),
    );
    y += 38;
  }

  // ── Items table ──────────────────────────────────────────────────────────
  pages[pages.length - 1].push(hline(MX, y, PW - MX));
  y += 16;
  pages[pages.length - 1].push(itemTableHeader(y));
  y += 24;

  let alt = false;
  for (const item of sale.items) {
    const discAmt    = mn(item.discountAmount);
    const typeLabel  = item.discountType === "PERCENT"
      ? `${mn(item.discountValue)}%`
      : item.discountType === "FIXED" ? "Nominal" : "";
    const hasDisc    = discAmt > 0;
    const hasReason  = hasDisc && (item.discountReason ?? "").trim().length > 0;
    const rowH       = hasDisc ? (hasReason ? 54 : 42) : 32;

    if (y + rowH > 776) {
      pages[pages.length - 1].push(pageFooter(pages.length, 0));
      newPage();
      y = 100;
      pages[pages.length - 1].push(itemTableHeader(y));
      y += 24;
    }

    const r = itemRow(
      y,
      item.product.name,
      item.product.sku ?? "",
      item.qty,
      item.price,
      item.subtotal,
      discAmt,
      typeLabel,
      item.discountReason ?? "",
      alt,
    );
    pages[pages.length - 1].push(r.content);
    y += r.height;
    alt = !alt;
  }

  // ── Totals block ─────────────────────────────────────────────────────────
  if (y + 130 > 776) {
    pages[pages.length - 1].push(pageFooter(pages.length, 0));
    newPage();
    y = 100;
  }

  y += 14;
  pages[pages.length - 1].push(hline(MX, y, PW - MX));
  y += 22;

  pages[pages.length - 1].push(totalLine("Total Qty", String(totalQty), y));
  y += 20;

  pages[pages.length - 1].push(totalLine("Subtotal", rp(subtotalBeforeDiscount), y));
  y += 20;

  pages[pages.length - 1].push(totalLine("Total Diskon Grosir", `-${rp(totalItemDiscount)}`, y, false, ROSE));
  y += 20;

  if (sale.loyaltyApplied) {
    pages[pages.length - 1].push(totalLine("Subtotal Sebelum Loyalty", rp(subtotalBeforeLoyalty), y));
    y += 20;

    const loyaltyLabel = `Diskon Loyalty${sale.loyaltyMilestone ? ` (ke-${sale.loyaltyMilestone})` : ""}`;
    pages[pages.length - 1].push(totalLine(loyaltyLabel, `-${rp(sale.loyaltyDiscountAmount)}`, y, false, ROSE));
    y += 20;

    if (sale.loyaltyBenefitNote) {
      const note = `Catatan Loyalty: ${cut(sale.loyaltyBenefitNote, 50)}`;
      pages[pages.length - 1].push(
        box(TOT_LX, y - 2, CW - (TOT_LX - MX), 22, "#FFFBEB", "#FDE68A"),
        txt(note, TOT_LX + 6, y + 13, 8, false, "#78350F"),
      );
      y += 28;
    }
  }

  if (sale.returns.length > 0) {
    pages[pages.length - 1].push(totalLine("Total Retur", `-${rp(totalReturn)}`, y, false, ROSE));
    y += 20;
  }

  // Grand Total row
  pages[pages.length - 1].push(hline(TOT_LX, y + 4, PW - MX));
  y += 16;
  pages[pages.length - 1].push(
    box(TOT_LX - 2, y - 12, CW - (TOT_LX - MX) + 2, 26, "#F0FDFB"),
    totalLine("Grand Total", rp(sale.subtotal), y, true),
  );
  y += 26;

  pages[pages.length - 1].push(totalLine("Dibayar", rp(sale.paidAmount), y));
  y += 20;

  pages[pages.length - 1].push(totalLine("Kembali", rp(changeAmount), y));
  y += 20;

  // ── Returns section ──────────────────────────────────────────────────────
  if (sale.returns.length > 0) {
    y += 14;
    if (y + 90 > 776) {
      pages[pages.length - 1].push(pageFooter(pages.length, 0));
      newPage();
      y = 100;
    }
    pages[pages.length - 1].push(hline(MX, y, PW - MX));
    y += 16;
    pages[pages.length - 1].push(txt("Item Retur", MX, y, 11, true, NAVY));
    y += 16;
    pages[pages.length - 1].push(returnTableHeader(y));
    y += 22;

    for (const saleReturn of sale.returns) {
      for (const rItem of saleReturn.items) {
        if (y + 32 > 776) {
          pages[pages.length - 1].push(pageFooter(pages.length, 0));
          newPage();
          y = 100;
          pages[pages.length - 1].push(returnTableHeader(y));
          y += 22;
        }
        const reason = returnLabel(saleReturn.reason);
        const notes  = saleReturn.notes ? ` ${saleReturn.notes}` : "";
        pages[pages.length - 1].push(
          box(MX, y, CW, 28, "#FFF1F2", BORDER),
          txt(cut(fmtDate(saleReturn.createdAt), 18), MX + 6,  y + 18, 8,   false, MUTED),
          txt(cut(rItem.product.name, 24),             170,     y + 18, 9,   true,  NAVY),
          txt(rItem.product.sku ?? "-",                170,     y + 27, 7.5, false, MUTED),
          txt(String(rItem.qty),                       375,     y + 18, 8.5, false, NAVY),
          txt(rp(rItem.subtotal),                      452,     y + 18, 8.5, false, ROSE),
          txt(cut(reason + notes, 16),                 480,     y + 18, 8,   false, NAVY),
        );
        y += 28;
      }
    }
  }

  // ── Footer text ───────────────────────────────────────────────────────────
  y += 22;
  if (y + 28 > 790) {
    pages[pages.length - 1].push(pageFooter(pages.length, 0));
    newPage();
    y = 100;
  }
  pages[pages.length - 1].push(
    hline(MX, y, PW - MX),
    txt("Terima kasih sudah berbelanja.", MX, y + 18, 10, true, "#0F766E"),
  );

  // ── Fix footers with real total page count ────────────────────────────────
  const total      = pages.length;
  const finalPages = pages.map((pg, i) => [...pg, pageFooter(i + 1, total)].join("\n"));

  const filename = `invoice-${sale.invoiceNumber}.pdf`;

  return new NextResponse(new Uint8Array(buildPdf(finalPages)), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
