import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";

/**
 * Jembatan data untuk halaman "Terminal Analitik" (/reports/preview).
 * Read-only: hanya membaca dari tabel yang sudah ada (Sale, SaleItem,
 * SaleReturn, Purchase). Tidak mengubah laporan owner lama.
 */

export type TerminalKpi = {
  grossRevenue: number; // omzet kotor (subtotal penjualan)
  returnsValue: number; // total retur pelanggan
  netRevenue: number; // omzet bersih = kotor - retur
  transactions: number; // jumlah nota
  itemsSold: number; // jumlah qty produk terjual
  atv: number; // rata-rata nilai transaksi
  purchases: number; // total pembelian stok ke supplier
};

export type TerminalKpis = {
  current: TerminalKpi;
  previous: TerminalKpi; // periode sebelumnya yg setara (untuk % perubahan)
  today: TerminalKpi;
  yesterday: TerminalKpi;
};

async function periodStats(from: Date, to: Date): Promise<TerminalKpi> {
  const createdAt = { gte: from, lte: to };
  const saleWhere = { createdAt, ...FINAL_SALE_STATUS_WHERE };

  const [sales, items, returns, purchases] = await Promise.all([
    prisma.sale.aggregate({
      where: saleWhere,
      _sum: { subtotal: true },
      _count: { _all: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: saleWhere },
      _sum: { qty: true },
    }),
    prisma.saleReturn.aggregate({
      where: {
        returnType: "CUSTOMER_RETURN",
        createdAt,
        sale: FINAL_SALE_STATUS_WHERE,
      },
      _sum: { totalRefund: true },
    }),
    prisma.purchase.aggregate({
      where: { createdAt },
      _sum: { total: true },
    }),
  ]);

  const grossRevenue = sales._sum.subtotal ?? 0;
  const returnsValue = returns._sum.totalRefund ?? 0;
  const transactions = sales._count._all;

  return {
    grossRevenue,
    returnsValue,
    netRevenue: Math.max(grossRevenue - returnsValue, 0),
    transactions,
    itemsSold: items._sum.qty ?? 0,
    atv: transactions > 0 ? Math.round(grossRevenue / transactions) : 0,
    purchases: purchases._sum.total ?? 0,
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

/* ─────────────────────────────────────────────────────────────────────────
   TIME-SERIES untuk 5 grafik (Per Jam → Tahunan) + sparkline KPI.
   Pengelompokan dilakukan di JS pakai waktu lokal server (hindari isu
   timezone & casting enum di SQL mentah). income = penjualan, expense =
   pembelian stok. Semua nilai dalam rupiah penuh.
   ──────────────────────────────────────────────────────────────────────── */

export type TerminalGranularity = "jam" | "harian" | "mingguan" | "bulanan" | "tahunan";

export type TerminalSpark = {
  netRevenue: number[];
  grossRevenue: number[];
  transactions: number[];
  itemsSold: number[];
  returnsValue: number[];
  purchases: number[];
};

// Satu grafik adaptif: satuan dipilih otomatis dari panjang periode.
export type TerminalChartData = {
  granularity: TerminalGranularity;
  title: string;
  rangeNote: string;
  labels: string[];
  income: number[];
  expense: number[];
  spark: TerminalSpark;
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function bucketSum<T>(rows: T[], keyOf: (r: T) => string, valueOf: (r: T) => number) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    map.set(k, (map.get(k) ?? 0) + valueOf(r));
  }
  return map;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const hourKey = (d: Date) => `${dayKey(d)}-${d.getHours()}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const yearKey = (d: Date) => `${d.getFullYear()}`;
function weekStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Senin = 0
  x.setDate(x.getDate() - dow);
  return x;
}
const weekKey = (d: Date) => dayKey(weekStart(d));

function diffDaysInclusive(from: Date, to: Date) {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

function chooseGranularity(from: Date, to: Date): TerminalGranularity {
  const days = diffDaysInclusive(from, to);
  if (days <= 1) return "jam";
  if (days <= 45) return "harian";
  if (days <= 182) return "mingguan";
  if (days <= 1095) return "bulanan";
  return "tahunan";
}

const GRAN_TITLE: Record<TerminalGranularity, string> = {
  jam: "Per Jam", harian: "Per Hari", mingguan: "Per Minggu", bulanan: "Per Bulan", tahunan: "Per Tahun",
};
const GRAN_LOWER: Record<TerminalGranularity, string> = {
  jam: "jam", harian: "hari", mingguan: "minggu", bulanan: "bulan", tahunan: "tahun",
};

export async function getTerminalSeries(range: {
  from: Date;
  to: Date;
}): Promise<TerminalChartData> {
  const { from, to } = range;
  const now = new Date();
  const granularity = chooseGranularity(from, to);

  // Susun daftar bucket (titik grafik) yang menutup [from, to] pada satuan terpilih.
  const starts: Date[] = [];
  const labels: string[] = [];
  let keyOf: (d: Date) => string;

  if (granularity === "jam") {
    const base = from;
    const lastHour = dayKey(base) === dayKey(now) ? now.getHours() : 23;
    for (let h = 0; h <= lastHour; h++) {
      starts.push(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h));
      labels.push(`${String(h).padStart(2, "0")}.00`);
    }
    keyOf = hourKey;
  } else if (granularity === "harian") {
    const d = new Date(from); d.setHours(0, 0, 0, 0);
    const end = new Date(to); end.setHours(0, 0, 0, 0);
    while (d <= end) { starts.push(new Date(d)); labels.push(`${d.getDate()}/${d.getMonth() + 1}`); d.setDate(d.getDate() + 1); }
    keyOf = dayKey;
  } else if (granularity === "mingguan") {
    const d = weekStart(from); const end = weekStart(to);
    while (d <= end) { starts.push(new Date(d)); labels.push(`${d.getDate()}/${d.getMonth() + 1}`); d.setDate(d.getDate() + 7); }
    keyOf = weekKey;
  } else if (granularity === "bulanan") {
    const multiYear = from.getFullYear() !== to.getFullYear();
    const d = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);
    while (d <= end) { starts.push(new Date(d)); labels.push(MONTH_SHORT[d.getMonth()] + (multiYear ? ` '${String(d.getFullYear()).slice(2)}` : "")); d.setMonth(d.getMonth() + 1); }
    keyOf = monthKey;
  } else {
    const d = new Date(from.getFullYear(), 0, 1);
    const end = new Date(to.getFullYear(), 0, 1);
    while (d <= end) { starts.push(new Date(d)); labels.push(String(d.getFullYear())); d.setFullYear(d.getFullYear() + 1); }
    keyOf = yearKey;
  }

  // Sparkline KPI: selalu 14 hari terakhir (indikator momentum, lepas dari periode).
  const spark0 = new Date(now); spark0.setDate(spark0.getDate() - 13); spark0.setHours(0, 0, 0, 0);

  const [sales, purchases, sparkSales, sparkPurchases, sparkItems, sparkReturns] = await Promise.all([
    prisma.sale.findMany({ where: { createdAt: { gte: from, lte: to }, ...FINAL_SALE_STATUS_WHERE }, select: { createdAt: true, subtotal: true } }),
    prisma.purchase.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { createdAt: true, total: true } }),
    prisma.sale.findMany({ where: { createdAt: { gte: spark0 }, ...FINAL_SALE_STATUS_WHERE }, select: { createdAt: true, subtotal: true } }),
    prisma.purchase.findMany({ where: { createdAt: { gte: spark0 } }, select: { createdAt: true, total: true } }),
    prisma.saleItem.findMany({ where: { sale: { createdAt: { gte: spark0 }, ...FINAL_SALE_STATUS_WHERE } }, select: { qty: true, sale: { select: { createdAt: true } } } }),
    prisma.saleReturn.findMany({ where: { returnType: "CUSTOMER_RETURN", createdAt: { gte: spark0 }, sale: FINAL_SALE_STATUS_WHERE }, select: { createdAt: true, totalRefund: true } }),
  ]);

  const inc = bucketSum(sales, (s) => keyOf(s.createdAt), (s) => s.subtotal);
  const exp = bucketSum(purchases, (p) => keyOf(p.createdAt), (p) => p.total);
  const income = starts.map((d) => inc.get(keyOf(d)) ?? 0);
  const expense = starts.map((d) => exp.get(keyOf(d)) ?? 0);

  // Sparkline 14 hari
  const sparkDays: Date[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); sparkDays.push(d); }
  const revByDay = bucketSum(sparkSales, (s) => dayKey(s.createdAt), (s) => s.subtotal);
  const txnByDay = bucketSum(sparkSales, (s) => dayKey(s.createdAt), () => 1);
  const purByDay = bucketSum(sparkPurchases, (p) => dayKey(p.createdAt), (p) => p.total);
  const itemByDay = bucketSum(sparkItems, (it) => dayKey(it.sale.createdAt), (it) => it.qty);
  const retByDay = bucketSum(sparkReturns, (r) => dayKey(r.createdAt), (r) => r.totalRefund ?? 0);

  const grossRevenue = sparkDays.map((d) => revByDay.get(dayKey(d)) ?? 0);
  const returnsValue = sparkDays.map((d) => retByDay.get(dayKey(d)) ?? 0);
  const spark: TerminalSpark = {
    grossRevenue,
    returnsValue,
    netRevenue: grossRevenue.map((v, i) => Math.max(v - returnsValue[i], 0)),
    transactions: sparkDays.map((d) => txnByDay.get(dayKey(d)) ?? 0),
    itemsSold: sparkDays.map((d) => itemByDay.get(dayKey(d)) ?? 0),
    purchases: sparkDays.map((d) => purByDay.get(dayKey(d)) ?? 0),
  };

  return {
    granularity,
    title: GRAN_TITLE[granularity],
    rangeNote: `Otomatis dikelompokkan per ${GRAN_LOWER[granularity]}`,
    labels,
    income,
    expense,
    spark,
  };
}

export async function getTerminalKpis(range: {
  from: Date;
  to: Date;
}): Promise<TerminalKpis> {
  const { from, to } = range;

  // periode sebelumnya yang setara: panjang sama, tepat sebelum 'from'
  const spanMs = Math.max(to.getTime() - from.getTime(), 0);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const yesterdayStart = startOfDay(new Date(todayStart.getTime() - 1));
  const yesterdayEnd = new Date(todayStart.getTime() - 1);

  const [current, previous, today, yesterday] = await Promise.all([
    periodStats(from, to),
    periodStats(prevFrom, prevTo),
    periodStats(todayStart, todayEnd),
    periodStats(yesterdayStart, yesterdayEnd),
  ]);

  return { current, previous, today, yesterday };
}
