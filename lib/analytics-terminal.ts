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
  yesterdaySoFar: TerminalKpi; // kemarin s/d jam yang sama dgn sekarang (perbandingan adil)
};

async function periodStats(from: Date, to: Date): Promise<TerminalKpi> {
  const createdAt = { gte: from, lte: to };
  const saleWhere = { createdAt, ...FINAL_SALE_STATUS_WHERE };

  const [sales, items, returns, purchases, ops] = await Promise.all([
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
    prisma.expense.aggregate({
      where: { date: createdAt },
      _sum: { amount: true },
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
    purchases: (purchases._sum.total ?? 0) + (ops._sum.amount ?? 0),
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

export type TerminalSeriesId = "harian" | "bulanan" | "tahunan";

export type TerminalSeries = {
  id: TerminalSeriesId;
  title: string;
  rangeNote: string;
  labels: string[];
  income: number[];
  expense: number[];
};

export type TerminalSpark = {
  netRevenue: number[];
  grossRevenue: number[];
  transactions: number[];
  itemsSold: number[];
  returnsValue: number[];
  purchases: number[];
};

// 3 grafik (Harian/Bulanan/Tahunan), semuanya mengikuti periode terpilih.
export type TerminalChartData = {
  series: TerminalSeries[];
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
const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
const yearKey = (d: Date) => `${d.getFullYear()}`;

const SERIES_META: { id: TerminalSeriesId; title: string; rangeNote: string }[] = [
  { id: "harian", title: "Harian", rangeNote: "Per hari dalam periode" },
  { id: "bulanan", title: "Bulanan", rangeNote: "Per bulan dalam periode" },
  { id: "tahunan", title: "Tahunan", rangeNote: "Per tahun dalam periode" },
];

// Susun daftar bucket (titik grafik) yang menutup [from, to] pada satuan tertentu.
function buildBuckets(id: TerminalSeriesId, from: Date, to: Date) {
  const starts: Date[] = [];
  const labels: string[] = [];
  let keyOf: (d: Date) => string;

  if (id === "harian") {
    const d = new Date(from); d.setHours(0, 0, 0, 0);
    const end = new Date(to); end.setHours(0, 0, 0, 0);
    while (d <= end) { starts.push(new Date(d)); labels.push(`${d.getDate()}/${d.getMonth() + 1}`); d.setDate(d.getDate() + 1); }
    keyOf = dayKey;
  } else if (id === "bulanan") {
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
  return { starts, labels, keyOf };
}

export async function getTerminalSeries(range: {
  from: Date;
  to: Date;
}): Promise<TerminalChartData> {
  const { from, to } = range;
  const now = new Date();

  // Sparkline KPI: selalu 14 hari terakhir (indikator momentum, lepas dari periode).
  const spark0 = new Date(now); spark0.setDate(spark0.getDate() - 13); spark0.setHours(0, 0, 0, 0);

  const [sales, purchases, expenses, sparkSales, sparkPurchases, sparkExpenses, sparkItems, sparkReturns] = await Promise.all([
    prisma.sale.findMany({ where: { createdAt: { gte: from, lte: to }, ...FINAL_SALE_STATUS_WHERE }, select: { createdAt: true, subtotal: true } }),
    prisma.purchase.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { createdAt: true, total: true } }),
    prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, amount: true } }),
    prisma.sale.findMany({ where: { createdAt: { gte: spark0 }, ...FINAL_SALE_STATUS_WHERE }, select: { createdAt: true, subtotal: true } }),
    prisma.purchase.findMany({ where: { createdAt: { gte: spark0 } }, select: { createdAt: true, total: true } }),
    prisma.expense.findMany({ where: { date: { gte: spark0 } }, select: { date: true, amount: true } }),
    prisma.saleItem.findMany({ where: { sale: { createdAt: { gte: spark0 }, ...FINAL_SALE_STATUS_WHERE } }, select: { qty: true, sale: { select: { createdAt: true } } } }),
    prisma.saleReturn.findMany({ where: { returnType: "CUSTOMER_RETURN", createdAt: { gte: spark0 }, sale: FINAL_SALE_STATUS_WHERE }, select: { createdAt: true, totalRefund: true } }),
  ]);

  // 3 grafik — expense = pembelian stok + pengeluaran operasional
  const series: TerminalSeries[] = SERIES_META.map((m) => {
    const { starts, labels, keyOf } = buildBuckets(m.id, from, to);
    const inc = bucketSum(sales, (s) => keyOf(s.createdAt), (s) => s.subtotal);
    const pur = bucketSum(purchases, (p) => keyOf(p.createdAt), (p) => p.total);
    const ops = bucketSum(expenses, (e) => keyOf(e.date), (e) => e.amount);
    return {
      id: m.id,
      title: m.title,
      rangeNote: m.rangeNote,
      labels,
      income: starts.map((d) => inc.get(keyOf(d)) ?? 0),
      expense: starts.map((d) => (pur.get(keyOf(d)) ?? 0) + (ops.get(keyOf(d)) ?? 0)),
    };
  });

  // Sparkline 14 hari
  const sparkDays: Date[] = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); sparkDays.push(d); }
  const revByDay = bucketSum(sparkSales, (s) => dayKey(s.createdAt), (s) => s.subtotal);
  const txnByDay = bucketSum(sparkSales, (s) => dayKey(s.createdAt), () => 1);
  const purByDay = bucketSum(sparkPurchases, (p) => dayKey(p.createdAt), (p) => p.total);
  const expByDay = bucketSum(sparkExpenses, (e) => dayKey(e.date), (e) => e.amount);
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
    purchases: sparkDays.map((d) => (purByDay.get(dayKey(d)) ?? 0) + (expByDay.get(dayKey(d)) ?? 0)),
  };

  return { series, spark };
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

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const yesterdayStart = startOfDay(new Date(todayStart.getTime() - 1));
  const yesterdayEnd = new Date(todayStart.getTime() - 1);
  // Kemarin DARI 00:00 sampai jam yang sama dengan SEKARANG → pembanding adil
  // untuk "hari ini" yang masih berjalan (bukan dibanding kemarin sehari penuh).
  const yesterdaySoFarEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [current, previous, today, yesterday, yesterdaySoFar] = await Promise.all([
    periodStats(from, to),
    periodStats(prevFrom, prevTo),
    periodStats(todayStart, todayEnd),
    periodStats(yesterdayStart, yesterdayEnd),
    periodStats(yesterdayStart, yesterdaySoFarEnd),
  ]);

  return { current, previous, today, yesterday, yesterdaySoFar };
}
