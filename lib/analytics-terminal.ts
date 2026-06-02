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
