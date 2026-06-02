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

export type TerminalSeries = {
  id: "jam" | "harian" | "mingguan" | "bulanan" | "tahunan";
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

export async function getTerminalSeries(): Promise<TerminalChartData> {
  const now = new Date();
  const fiveYearsAgo = new Date(now.getFullYear() - 4, 0, 1);
  const spark0 = new Date(now);
  spark0.setDate(spark0.getDate() - 13);
  spark0.setHours(0, 0, 0, 0);

  const saleWhere = { createdAt: { gte: fiveYearsAgo }, ...FINAL_SALE_STATUS_WHERE };

  const [sales, purchases, sparkItems, sparkReturns] = await Promise.all([
    prisma.sale.findMany({ where: saleWhere, select: { createdAt: true, subtotal: true } }),
    prisma.purchase.findMany({ where: { createdAt: { gte: fiveYearsAgo } }, select: { createdAt: true, total: true } }),
    prisma.saleItem.findMany({
      where: { sale: { createdAt: { gte: spark0 }, ...FINAL_SALE_STATUS_WHERE } },
      select: { qty: true, sale: { select: { createdAt: true } } },
    }),
    prisma.saleReturn.findMany({
      where: { returnType: "CUSTOMER_RETURN", createdAt: { gte: spark0 }, sale: FINAL_SALE_STATUS_WHERE },
      select: { createdAt: true, totalRefund: true },
    }),
  ]);

  const buildSeries = (
    id: TerminalSeries["id"],
    starts: Date[],
    labels: string[],
    keyOf: (d: Date) => string,
  ): TerminalSeries => {
    const inc = bucketSum(sales, (s) => keyOf(s.createdAt), (s) => s.subtotal);
    const exp = bucketSum(purchases, (p) => keyOf(p.createdAt), (p) => p.total);
    return {
      id,
      labels,
      income: starts.map((d) => inc.get(keyOf(d)) ?? 0),
      expense: starts.map((d) => exp.get(keyOf(d)) ?? 0),
    };
  };

  // Per Jam: hari ini, jam 0..jam sekarang
  const hourStarts: Date[] = [];
  const hourLabels: string[] = [];
  for (let h = 0; h <= now.getHours(); h++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h);
    hourStarts.push(d);
    hourLabels.push(String(h).padStart(2, "0"));
  }

  // Harian: 30 hari terakhir
  const dayStarts: Date[] = [];
  const dayLabels: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dayStarts.push(d);
    dayLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }

  // Mingguan: 12 minggu terakhir (mulai Senin)
  const weekStarts: Date[] = [];
  const weekLabels: string[] = [];
  const thisWeek = weekStart(now);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(thisWeek);
    d.setDate(d.getDate() - i * 7);
    weekStarts.push(d);
    weekLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }

  // Bulanan: 12 bulan terakhir
  const monthStarts: Date[] = [];
  const monthLabels: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthStarts.push(d);
    monthLabels.push(MONTH_SHORT[d.getMonth()]);
  }

  // Tahunan: 5 tahun terakhir
  const yearStarts: Date[] = [];
  const yearLabels: string[] = [];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now.getFullYear() - i, 0, 1);
    yearStarts.push(d);
    yearLabels.push(String(d.getFullYear()));
  }

  const series: TerminalSeries[] = [
    buildSeries("jam", hourStarts, hourLabels, hourKey),
    buildSeries("harian", dayStarts, dayLabels, dayKey),
    buildSeries("mingguan", weekStarts, weekLabels, weekKey),
    buildSeries("bulanan", monthStarts, monthLabels, monthKey),
    buildSeries("tahunan", yearStarts, yearLabels, yearKey),
  ];

  // Sparkline KPI: 14 hari terakhir
  const sparkDays: Date[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    sparkDays.push(d);
  }
  const revByDay = bucketSum(sales, (s) => dayKey(s.createdAt), (s) => s.subtotal);
  const txnByDay = bucketSum(sales, (s) => dayKey(s.createdAt), () => 1);
  const purByDay = bucketSum(purchases, (p) => dayKey(p.createdAt), (p) => p.total);
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
