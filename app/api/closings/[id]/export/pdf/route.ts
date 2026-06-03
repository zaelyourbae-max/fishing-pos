import { requireOwner } from "@/lib/auth-session";
import { dateInputValue, getDailyClosing } from "@/lib/daily-closing";
import { formatDateID, formatDateTimeID } from "@/lib/date-format";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { promises as fsp } from "fs";
import path from "path";

export const runtime = "nodejs";

// ── Layout ────────────────────────────────────────────────────────────────────
const PW = 595;
const PH = 842;
const MX = 40;
const CW = PW - MX * 2;        // 515
const RIGHT = MX + CW;         // 555
const CONTENT_TOP = 104;
const CONTENT_BOTTOM = 786;

// ── Colors ────────────────────────────────────────────────────────────────────
const C_NAVY    = rgb(0.059, 0.090, 0.165);
const C_SLATE   = rgb(0.200, 0.255, 0.333);
const C_MUTED   = rgb(0.580, 0.635, 0.722);
const C_BORDER  = rgb(0.886, 0.910, 0.941);
const C_TEAL    = rgb(0.051, 0.580, 0.533);
const C_TEAL_BG = rgb(0.941, 0.992, 0.980);
const C_STRIPE  = rgb(0.973, 0.980, 0.988);
const C_HDR_BG  = rgb(0.945, 0.961, 0.976);
const C_BLUE    = rgb(0.231, 0.510, 0.965);
const C_AMBER   = rgb(0.851, 0.467, 0.024);
const C_AMBER_BG= rgb(0.998, 0.980, 0.925);
const C_WHITE   = rgb(1, 1, 1);
const C_BYLINE  = rgb(0.576, 0.588, 0.624);

type C = ReturnType<typeof rgb>;

// ── Fonts ─────────────────────────────────────────────────────────────────────
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

// ── Draw primitives ─────────────────────────────────────────────────────────────
function baselineY(topY: number, font: PDFFont, size: number) {
  return PH - topY - font.heightAtSize(size, { descender: false });
}
function dt(p: PDFPage, t: string, x: number, topY: number, font: PDFFont, size: number, color: C) {
  p.drawText(t, { x, y: baselineY(topY, font, size), font, size, color });
}
function dtR(p: PDFPage, t: string, rx: number, topY: number, font: PDFFont, size: number, color: C) {
  dt(p, t, rx - font.widthOfTextAtSize(t, size), topY, font, size, color);
}
function dtSpaced(p: PDFPage, t: string, x: number, topY: number, font: PDFFont, size: number, color: C, sp: number) {
  let cx = x;
  for (const ch of t) { dt(p, ch, cx, topY, font, size, color); cx += font.widthOfTextAtSize(ch, size) + sp; }
}
function dr(p: PDFPage, x: number, topY: number, w: number, h: number, color: C, bc?: C, bw = 0.5) {
  p.drawRectangle({ x, y: PH - topY - h, width: w, height: h, color, ...(bc ? { borderColor: bc, borderWidth: bw } : {}) });
}
function rounded(p: PDFPage, x: number, topY: number, w: number, h: number, r: number, color: C, bc?: C) {
  const k = 0.5523, kr = r * k;
  const pth = [
    `M ${r} 0`, `L ${w - r} 0`, `C ${w - kr} 0 ${w} ${kr} ${w} ${r}`,
    `L ${w} ${h - r}`, `C ${w} ${h - kr} ${w - kr} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`, `C ${kr} ${h} 0 ${h - kr} 0 ${h - r}`,
    `L 0 ${r}`, `C 0 ${kr} ${kr} 0 ${r} 0`, "Z",
  ].join(" ");
  p.drawSvgPath(pth, { x, y: PH - topY, color, ...(bc ? { borderColor: bc, borderWidth: 0.5 } : {}) });
}
function hl(p: PDFPage, x1: number, topY: number, x2: number, color: C, w = 0.5) {
  p.drawLine({ start: { x: x1, y: PH - topY }, end: { x: x2, y: PH - topY }, thickness: w, color });
}
function rowText(p: PDFPage, t: string, x: number, rowTopY: number, rowH: number, font: PDFFont, size: number, color: C, right = false) {
  const topY = rowTopY + (rowH - font.heightAtSize(size, { descender: false })) / 2 - 0.5;
  if (right) dtR(p, t, x, topY, font, size, color); else dt(p, t, x, topY, font, size, color);
}
function cutW(t: string, font: PDFFont, size: number, maxW: number) {
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  let s = t;
  while (s.length > 1 && font.widthOfTextAtSize(`${s}..`, size) > maxW) s = s.slice(0, -1);
  return `${s}..`;
}
function fitSize(t: string, font: PDFFont, maxSize: number, minSize: number, maxW: number) {
  let s = maxSize;
  while (s > minSize && font.widthOfTextAtSize(t, s) > maxW) s -= 0.5;
  return s;
}

// ── Data types & helpers ────────────────────────────────────────────────────────
type PaymentRow = { method: string; total: number; count: number };

function fmtRupiah(v: number) { return `Rp ${v.toLocaleString("id-ID")}`; }
function fmtDate(d: Date)     { return formatDateID(d); }
function fmtDateTime(d?: Date | null) { return d ? formatDateTimeID(d) : "-"; }

function objectValue(v: unknown, key: string) {
  return v && typeof v === "object" ? (v as Record<string, unknown>)[key] : undefined;
}
function numberValue(v: unknown) { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; }

function parsePaymentSummary(value: unknown): PaymentRow[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    method: String(objectValue(item, "method") ?? "-"),
    total:  numberValue(objectValue(item, "total")),
    count:  numberValue(objectValue(item, "count")),
  }));
}

function paymentLabel(method: string) {
  const n = method.toUpperCase();
  if (n === "CASH")  return "Cash";
  if (n === "QRIS")  return "QRIS";
  if (n === "TRANSFER" || n === "BANK_TRANSFER") return "Transfer Bank";
  return method.replaceAll("_", " ");
}

function diffStatus(v: number) {
  if (v === 0) return "Sesuai";
  return v < 0 ? "Kurang" : "Lebih";
}

function statusLabel(status: string) {
  return status === "CLOSED" ? "Closed" : "Open";
}

// ── Header / Footer (identik dengan PDF Laporan Owner) ──────────────────────────
function drawHeader(p: PDFPage, f: Fonts, storeName: string, closingDate: Date, status: string, printedAt: string) {
  // teal accent bar
  rounded(p, MX, 26, 4, 58, 2, C_TEAL);

  // Left: brand identity
  dt(p, storeName, MX + 14, 30, f.r800, 19, C_NAVY);
  dt(p, "by Meijrverse\xb0", MX + 14, 58, f.r400, 9, C_BYLINE);

  // Right: document title "LAPORAN CLOSING" with letter-spacing
  const title = "LAPORAN CLOSING";
  const tSp = 1.5, tSz = 15;
  let tW = -tSp;
  for (const ch of title) tW += f.r800.widthOfTextAtSize(ch, tSz) + tSp;
  dtSpaced(p, title, RIGHT - tW, 30, f.r800, tSz, C_TEAL, tSp);

  // Right: tanggal + dicetak (right-aligned label · value)
  const meta = (label: string, value: string, topY: number) => {
    const vW = f.r700.widthOfTextAtSize(value, 8.5);
    dtR(p, value, RIGHT, topY, f.r700, 8.5, C_NAVY);
    const lW = f.r400.widthOfTextAtSize(label, 8);
    dt(p, label, RIGHT - vW - 6 - lW, topY + 0.5, f.r400, 8, C_MUTED);
  };
  meta("Tanggal", fmtDate(closingDate), 54);
  meta("Dicetak", printedAt, 68);

  hl(p, MX, 90, RIGHT, C_TEAL, 1.5);

  // Status badge (left, under brand)
  const isClosed = status === "CLOSED";
  const badge = statusLabel(status);
  const bw = f.r700.widthOfTextAtSize(badge.toUpperCase(), 8) + 18;
  rounded(p, MX + 14, 74, bw, 14, 3, isClosed ? C_TEAL_BG : C_AMBER_BG, isClosed ? C_TEAL : C_AMBER);
  dt(p, badge.toUpperCase(), MX + 23, 78, f.r700, 8, isClosed ? C_TEAL : C_AMBER);
}

function drawFooter(p: PDFPage, f: Fonts, storeName: string, num: number, total: number) {
  hl(p, MX, 802, RIGHT, C_BORDER, 0.5);
  dt(p, storeName, MX, 812, f.r700, 7, C_MUTED);
  const mid = "by MeijrVerse\xb0";
  dt(p, mid, (PW - f.r400.widthOfTextAtSize(mid, 7)) / 2, 812, f.r400, 7, C_MUTED);
  dtR(p, `Halaman ${num} dari ${total}`, RIGHT, 812, f.r400, 7, C_MUTED);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const closing = await prisma.dailyClosing.findUnique({ where: { id }, select: { closingDate: true } });
  if (!closing) return NextResponse.json({ message: "Closing tidak ditemukan." }, { status: 404 });

  const [settings, fullClosing] = await Promise.all([getSettings(), getDailyClosing(prisma, closing.closingDate)]);
  if (!fullClosing) return NextResponse.json({ message: "Closing tidak ditemukan." }, { status: 404 });

  const paymentRows = parsePaymentSummary(fullClosing.paymentSummary);
  const storeName   = settings.storeName;
  const status      = fullClosing.status;
  const printedAt   = formatDateTimeID(new Date());

  // ── PDF setup ─────────────────────────────────────────────────────────────────
  const doc = await PDFDocument.create();
  const f = await loadFonts(doc);
  const pages: PDFPage[] = [];

  function startPage(): PDFPage {
    const p = doc.addPage([PW, PH]);
    pages.push(p);
    drawHeader(p, f, storeName, fullClosing!.closingDate, status, printedAt);
    return p;
  }

  let page = startPage();
  let y = CONTENT_TOP;

  // ── Section title ───────────────────────────────────────────────────────────
  function sectionTitle(label: string) {
    rounded(page, MX, y, CW, 24, 5, C_HDR_BG);
    rounded(page, MX, y, 3, 24, 1.5, C_TEAL);
    dt(page, label.toUpperCase(), MX + 14, y + 7, f.r700, 8.5, C_NAVY);
    y += 24 + 10;
  }

  // ── Metric cards (3 per row) ──────────────────────────────────────────────────
  const CARD_W = 165;
  const CARD_GAP = (CW - CARD_W * 3) / 2;  // 10
  const CARD_H = 72;
  function metricRow(cards: { label: string; value: string; helper: string; accent: C }[]) {
    cards.forEach((c, i) => {
      const x = MX + i * (CARD_W + CARD_GAP);
      rounded(page, x, y, CARD_W, CARD_H, 7, C_WHITE, C_BORDER);
      rounded(page, x, y + 6, 4, CARD_H - 12, 2, c.accent);
      dt(page, c.label.toUpperCase(), x + 16, y + 14, f.r600, 7.5, C_MUTED);
      const vs = fitSize(c.value, f.r800, 14, 9, CARD_W - 28);
      dt(page, c.value, x + 16, y + 32, f.r800, vs, C_NAVY);
      dt(page, c.helper, x + 16, y + 54, f.r400, 7.5, C_MUTED);
    });
    y += CARD_H + 12;
  }

  // ── Info box (label + value pairs, 2 columns) ─────────────────────────────────
  function infoBox(rows: { label: string; value: string }[][]) {
    const ROWH = 22;
    const boxH = rows.length * ROWH + 16;
    dr(page, MX, y, CW, boxH, C_STRIPE, C_BORDER);
    const colW = CW / 2;
    rows.forEach((cols, ri) => {
      const ry = y + 8 + ri * ROWH + ROWH / 2;
      cols.forEach((cell, ci) => {
        if (!cell.label && !cell.value) return;
        const lx = MX + 16 + ci * colW;
        dt(page, cell.label.toUpperCase(), lx, ry - 8, f.r600, 7, C_MUTED);
        const vMax = colW - 16 - 96;
        dt(page, cutW(cell.value, f.r600, 8.5, Math.max(vMax, 120)), lx + 96, ry - 8, f.r600, 8.5, C_NAVY);
      });
    });
    y += boxH + 12;
  }

  // ── Generic table ───────────────────────────────────────────────────────────
  type Col = { label: string; x: number; right?: boolean; maxW?: number };
  const HROW = 26;
  const TROWH = 24;

  function tableHead(cols: Col[]) {
    rounded(page, MX, y, CW, HROW, 4, C_NAVY);
    for (const c of cols) rowText(page, c.label, c.x, y, HROW, f.r700, 7.5, C_WHITE, c.right);
    y += HROW;
  }

  function table(cols: Col[], rows: string[][], contTitle: string, opts?: { totalRow?: string[] }) {
    tableHead(cols);
    rows.forEach((row, idx) => {
      if (y + TROWH > CONTENT_BOTTOM) {
        page = startPage(); y = CONTENT_TOP;
        sectionTitle(`${contTitle} (lanjutan)`);
        tableHead(cols);
      }
      dr(page, MX, y, CW, TROWH, idx % 2 === 0 ? C_WHITE : C_STRIPE, C_BORDER);
      cols.forEach((c, ci) => {
        const raw = row[ci] ?? "";
        const v = c.maxW ? cutW(raw, f.r400, 8, c.maxW) : raw;
        rowText(page, v, c.x, y, TROWH, f.r400, 8, C_SLATE, c.right);
      });
      y += TROWH;
    });
    if (opts?.totalRow) {
      if (y + TROWH > CONTENT_BOTTOM) { page = startPage(); y = CONTENT_TOP; tableHead(cols); }
      dr(page, MX, y, CW, TROWH, C_TEAL_BG, C_BORDER);
      cols.forEach((c, ci) => {
        const v = opts.totalRow![ci] ?? "";
        if (v) rowText(page, c.maxW ? cutW(v, f.r700, 8, c.maxW) : v, c.x, y, TROWH, f.r700, 8, C_TEAL, c.right);
      });
      y += TROWH;
    }
  }

  function emptyRow(message: string) {
    dr(page, MX, y, CW, TROWH, C_WHITE, C_BORDER);
    rowText(page, message, MX + 14, y, TROWH, f.r400, 8, C_MUTED);
    y += TROWH;
  }

  function ensureSpace(needed: number) {
    if (y + needed > CONTENT_BOTTOM) { page = startPage(); y = CONTENT_TOP; }
  }

  // ── REKONSILIASI KAS ──────────────────────────────────────────────────────────
  const diff = fullClosing.difference;
  const diffColor = diff === 0 ? C_TEAL : C_AMBER;
  sectionTitle("Rekonsiliasi Kas");
  metricRow([
    { label: "Expected Cash", value: fmtRupiah(fullClosing.expectedCash), helper: "Target kas tunai", accent: C_TEAL },
    { label: "Cash Aktual",   value: fmtRupiah(fullClosing.actualCash),   helper: "Kas dihitung",     accent: C_TEAL },
    { label: "Selisih",       value: fmtRupiah(diff),                     helper: diffStatus(diff),   accent: diffColor },
  ]);

  // ── RINGKASAN OMZET ─────────────────────────────────────────────────────────────
  sectionTitle("Ringkasan Omzet");
  metricRow([
    { label: "Omzet Kotor",     value: fmtRupiah(fullClosing.grossOmzet),     helper: "Sebelum retur",      accent: C_TEAL },
    { label: "Omzet Bersih",    value: fmtRupiah(fullClosing.netOmzet),       helper: "Setelah retur",      accent: C_TEAL },
    { label: "Total Transaksi", value: String(fullClosing.transactionCount),  helper: "Transaksi hari ini", accent: C_BLUE },
  ]);

  // ── DETAIL CLOSING ──────────────────────────────────────────────────────────────
  sectionTitle("Detail Closing");
  infoBox([
    [
      { label: "Status",        value: statusLabel(status) },
      { label: "Waktu Closing", value: fmtDateTime(fullClosing.closedAt) },
    ],
    [
      { label: "Closed by",   value: fullClosing.closedBy?.name ?? "-" },
      { label: "Nilai Retur", value: fmtRupiah(fullClosing.returnValue) },
    ],
  ]);

  // ── RINGKASAN PEMBAYARAN ──────────────────────────────────────────────────────
  sectionTitle("Ringkasan Pembayaran");
  const payCols: Col[] = [
    { label: "Metode",    x: MX + 14, maxW: 300 },
    { label: "Transaksi", x: 400, right: true, maxW: 80 },
    { label: "Total",     x: RIGHT - 8, right: true, maxW: 130 },
  ];
  if (paymentRows.length === 0) {
    tableHead(payCols);
    emptyRow("Belum ada pembayaran");
  } else {
    const payTotal = paymentRows.reduce((s, r) => s + r.total, 0);
    table(payCols,
      paymentRows.map((p) => [paymentLabel(p.method), String(p.count), fmtRupiah(p.total)]),
      "Ringkasan Pembayaran",
      { totalRow: ["Total", `${paymentRows.length} Metode`, fmtRupiah(payTotal)] },
    );
  }
  y += 14;

  // ── CATATAN CLOSING ───────────────────────────────────────────────────────────
  if (fullClosing.notes) {
    ensureSpace(70);
    sectionTitle("Catatan Closing");
    const lines = wrapText(fullClosing.notes, f.r400, 8.5, CW - 32);
    const boxH = Math.max(lines.length * 14 + 16, 36);
    dr(page, MX, y, CW, boxH, C_STRIPE, C_BORDER);
    lines.forEach((ln, i) => dt(page, ln, MX + 16, y + 12 + i * 14, f.r400, 8.5, C_SLATE));
    y += boxH + 12;
  }

  // ── REOPEN TERAKHIR ─────────────────────────────────────────────────────────────
  if (fullClosing.reopenedAt) {
    ensureSpace(90);
    sectionTitle("Reopen Terakhir");
    infoBox([
      [
        { label: "Reopened at", value: fmtDateTime(fullClosing.reopenedAt) },
        { label: "By",          value: fullClosing.reopenedBy?.name ?? "-" },
      ],
      [
        { label: "Alasan", value: fullClosing.reopenReason ?? "-" },
        { label: "", value: "" },
      ],
    ]);
  }

  // ── AUDIT LOG ────────────────────────────────────────────────────────────────
  ensureSpace(90);
  sectionTitle("Audit Log Closing");
  const logCols: Col[] = [
    { label: "Action",           x: MX + 14, maxW: 90 },
    { label: "User",             x: 150,     maxW: 110 },
    { label: "Waktu",            x: 270,     maxW: 120 },
    { label: "Alasan / Catatan", x: 400,     maxW: RIGHT - 400 - 8 },
  ];
  if (fullClosing.logs.length === 0) {
    tableHead(logCols);
    emptyRow("Belum ada audit log");
  } else {
    table(logCols,
      fullClosing.logs.map((log) => [
        log.action,
        log.user?.name ?? "-",
        fmtDateTime(log.createdAt),
        log.reason ?? log.note ?? "-",
      ]),
      "Audit Log Closing",
    );
  }

  // ── Footers ──────────────────────────────────────────────────────────────────
  const total = pages.length;
  pages.forEach((p, i) => drawFooter(p, f, storeName, i + 1, total));

  const pdfBytes = await doc.save();
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="closing-${dateInputValue(fullClosing.closingDate)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}

// ── Text wrapping (word-aware) ──────────────────────────────────────────────────
function wrapText(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxW) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}
