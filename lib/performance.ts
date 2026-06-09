import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";
import { startOfMonth, startOfToday } from "@/lib/reports";

/**
 * Modul Performa kasir. Dua sudut pandang (lihat memory performance-module):
 *  - Owner: bandingkan SEMUA kasir relatif ke kasir terbaik (peer-relative).
 *  - Kasir: bandingkan DIRI SENDIRI bulan ini vs bulan lalu (memotivasi, tanpa
 *    membocorkan peringkat antar-kasir).
 *
 * Semua angka memakai aturan transaksi SAH yang sama dengan Laporan
 * (FINAL_SALE_STATUS_WHERE) supaya konsisten — omzet = jumlah `subtotal`.
 */

export type PerfRange = {
  from: Date;
  to?: Date;
  label: string;
};

export type CashierMetrics = {
  omzet: number;
  txCount: number;
  avgPerTx: number;
  totalItems: number;
  avgItems: number;
  cancelCount: number;
};

export type CashierPerformanceRow = {
  id: number;
  name: string;
  metrics: CashierMetrics;
  /** Skor 0-100 per sumbu (relatif ke kasir terbaik). Urutan = RADAR_AXES. */
  axisScores: number[];
  /** Rata-rata semua sumbu = "Overall score". */
  overallScore: number;
};

export type SelfPerformance = {
  current: CashierMetrics;
  previous: CashierMetrics;
  /** Punya data bulan lalu untuk dibandingkan? */
  hasBaseline: boolean;
  /** Rata-rata pertumbuhan (this/last) dalam %, mis. 112 = naik 12%. null bila tak ada baseline. */
  overallScore: number | null;
};

// Sumbu radar untuk tampilan OWNER (lebih = lebih baik; "Ketelitian" = kebalikan
// pembatalan, jadi kasir dgn pembatalan terbanyak = paling rendah).
export const RADAR_AXES = [
  "Omzet",
  "Transaksi",
  "Belanja",
  "Barang",
  "Ketelitian",
] as const;

// Sumbu radar untuk tampilan KASIR (bulan ini vs lalu). Pembatalan ditampilkan
// terpisah sebagai catatan, bukan di radar, agar grafik tetap "lebih = lebih baik".
export const SELF_AXES = [
  "Omzet",
  "Transaksi",
  "Belanja",
  "Barang",
] as const;

export function bulanIniRange(): PerfRange {
  return { from: startOfMonth(), label: "Bulan ini" };
}

export function hariIniRange(): PerfRange {
  return { from: startOfToday(), label: "Hari ini" };
}

function startOfLastMonth() {
  const date = startOfMonth();
  date.setMonth(date.getMonth() - 1);

  return date;
}

function round(value: number) {
  return Math.round(value);
}

/** Hitung metrik mentah satu kasir pada rentang [from, to). */
export async function computeCashierMetrics(
  cashierId: number,
  range: PerfRange,
): Promise<CashierMetrics> {
  const createdAt = range.to
    ? { gte: range.from, lte: range.to }
    : { gte: range.from };

  const finalWhere = {
    cashierId,
    createdAt,
    ...FINAL_SALE_STATUS_WHERE,
  };

  const [saleAgg, itemAgg, cancelCount] = await Promise.all([
    prisma.sale.aggregate({
      where: finalWhere,
      _sum: { subtotal: true },
      _count: { _all: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: finalWhere },
      _sum: { qty: true },
    }),
    prisma.sale.count({
      where: { cashierId, createdAt, transactionStatus: "CANCELLED" },
    }),
  ]);

  const omzet = saleAgg._sum.subtotal ?? 0;
  const txCount = saleAgg._count._all;
  const totalItems = itemAgg._sum.qty ?? 0;

  return {
    omzet,
    txCount,
    avgPerTx: txCount > 0 ? round(omzet / txCount) : 0,
    totalItems,
    avgItems: txCount > 0 ? totalItems / txCount : 0,
    cancelCount,
  };
}

function normalize(value: number, max: number) {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

/** Skor kebalikan: makin kecil makin baik (untuk pembatalan → "Ketelitian"). */
function normalizeInverse(value: number, max: number) {
  return max > 0 ? Math.round((1 - value / max) * 100) : 100;
}

/**
 * OWNER: performa semua kasir pada rentang tertentu, sudah dinormalkan relatif
 * ke kasir terbaik tiap sumbu. Diurutkan dari overall score tertinggi.
 */
export async function getAllCashierPerformance(
  range: PerfRange,
): Promise<CashierPerformanceRow[]> {
  const cashiers = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      role: { slug: "cashier" },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    cashiers.map(async (cashier) => ({
      id: cashier.id,
      name: cashier.name,
      metrics: await computeCashierMetrics(cashier.id, range),
    })),
  );

  const maxOmzet = Math.max(0, ...rows.map((r) => r.metrics.omzet));
  const maxTx = Math.max(0, ...rows.map((r) => r.metrics.txCount));
  const maxAvgPerTx = Math.max(0, ...rows.map((r) => r.metrics.avgPerTx));
  const maxAvgItems = Math.max(0, ...rows.map((r) => r.metrics.avgItems));
  const maxCancel = Math.max(0, ...rows.map((r) => r.metrics.cancelCount));

  const scored = rows.map((row) => {
    // Kasir tanpa transaksi pada periode ini → semua skor 0 (jangan dianggap
    // "100% ketelitian" hanya karena belum pernah membatalkan apa pun).
    const axisScores =
      row.metrics.txCount === 0
        ? [0, 0, 0, 0, 0]
        : [
            normalize(row.metrics.omzet, maxOmzet),
            normalize(row.metrics.txCount, maxTx),
            normalize(row.metrics.avgPerTx, maxAvgPerTx),
            normalize(row.metrics.avgItems, maxAvgItems),
            normalizeInverse(row.metrics.cancelCount, maxCancel),
          ];
    const overallScore = Math.round(
      axisScores.reduce((sum, value) => sum + value, 0) / axisScores.length,
    );

    return { ...row, axisScores, overallScore };
  });

  return scored.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * KASIR: performa diri sendiri bulan ini vs bulan lalu.
 */
export async function getSelfPerformance(
  cashierId: number,
): Promise<SelfPerformance> {
  const current = await computeCashierMetrics(cashierId, bulanIniRange());
  const previous = await computeCashierMetrics(cashierId, {
    from: startOfLastMonth(),
    to: startOfMonth(),
    label: "Bulan lalu",
  });

  // Rata-rata rasio (ini/lalu) untuk sumbu yang punya pembanding bulan lalu.
  const ratios: number[] = [];
  const pairs: [number, number][] = [
    [current.omzet, previous.omzet],
    [current.txCount, previous.txCount],
    [current.avgPerTx, previous.avgPerTx],
    [current.avgItems, previous.avgItems],
  ];
  for (const [cur, prev] of pairs) {
    if (prev > 0) {
      ratios.push((cur / prev) * 100);
    }
  }

  const hasBaseline = ratios.length > 0;
  const overallScore = hasBaseline
    ? Math.round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length)
    : null;

  return { current, previous, hasBaseline, overallScore };
}

/**
 * Sumbu radar kasir (this vs last), keduanya dinormalkan ke nilai maksimum
 * antara bulan ini & lalu per sumbu → dua poligon yang bisa langsung dibandingkan.
 */
export function selfRadarSeries(self: SelfPerformance) {
  const axes: [number, number][] = [
    [self.current.omzet, self.previous.omzet],
    [self.current.txCount, self.previous.txCount],
    [self.current.avgPerTx, self.previous.avgPerTx],
    [self.current.avgItems, self.previous.avgItems],
  ];

  const currentSeries: number[] = [];
  const previousSeries: number[] = [];
  for (const [cur, prev] of axes) {
    const max = Math.max(cur, prev);
    currentSeries.push(normalize(cur, max));
    previousSeries.push(normalize(prev, max));
  }

  return { currentSeries, previousSeries };
}
