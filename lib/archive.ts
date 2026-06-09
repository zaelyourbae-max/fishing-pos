import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE } from "@/lib/sale-status";

/**
 * Arsip data transaksi lama (housekeeping) — daur hidup 3 tahap:
 *
 *   1) ARSIP  : tandai transaksi lama (umur >= ARCHIVE_AGE_YEARS tahun) dengan
 *               `archivedAt`. Ini HANYA penanda — TIDAK mengubah angka laporan,
 *               dashboard, closing, maupun hitungan loyalty. Data terarsip tetap
 *               dihitung penuh di semua tempat. Yang berubah cuma: ia muncul di
 *               halaman Arsip & bisa dipilih untuk dirapikan lebih lanjut.
 *   2) EKSPOR : arsip diunduh ke file (PDF/Excel) → set `exportedAt`. (Tahap 2)
 *   3) HAPUS  : HANYA arsip yang sudah diekspor boleh dihapus permanen. Saat
 *               itulah angka "sepanjang masa" (mis. hitungan loyalty) bisa
 *               berubah, jadi penghapusan menyimpan rekap per-pelanggan dulu
 *               supaya status loyalty tetap valid. (Tahap 3)
 *
 * Catatan validitas: semua laporan/dashboard/closing memakai jendela waktu
 * (hari ini / bulan ini / rentang pilihan), jadi data berumur >= 3 tahun tidak
 * pernah ikut terhitung di sana. Titik rawan satu-satunya adalah agregat
 * "sepanjang masa" pada loyalty pelanggan — ditangani di Tahap 3 (penghapusan).
 */

export const ARCHIVE_AGE_YEARS = 3;

/** Transaksi dengan createdAt SEBELUM tanggal ini layak diarsipkan. */
export function archiveThresholdDate(now = new Date()): Date {
  const date = new Date(now);
  date.setFullYear(date.getFullYear() - ARCHIVE_AGE_YEARS);

  return date;
}

export type ArchivePreview = {
  /** Batas tanggal: transaksi lebih tua dari ini yang dianggap layak arsip. */
  thresholdDate: Date;
  ageYears: number;
  /** Jumlah transaksi yang BISA diarsipkan sekarang (belum diarsip). */
  eligibleCount: number;
  /** Transaksi terlama di antara yang layak (untuk ditampilkan: "Jan 2022 – …"). */
  oldestDate: Date | null;
  /** Transaksi termuda di antara yang layak (paling dekat ke batas). */
  newestDate: Date | null;
  /** Jumlah nilai (subtotal) dari yang layak — sekadar konteks bagi owner. */
  grossValue: number;
};

export type ArchiveStats = {
  /** Sudah diarsip & belum dihapus permanen. */
  archivedCount: number;
  archivedGrossValue: number;
  /** Sudah diarsip DAN sudah diekspor → siap dihapus permanen (Tahap 3). */
  exportedCount: number;
  /** Sudah diarsip tapi BELUM diekspor → belum boleh dihapus. */
  notExportedCount: number;
};

const ELIGIBLE_WHERE = (thresholdDate: Date) => ({
  createdAt: { lt: thresholdDate },
  archivedAt: null,
});

/** Pratinjau: apa yang akan terjadi bila owner menekan "Arsipkan" sekarang. */
export async function getArchivePreview(now = new Date()): Promise<ArchivePreview> {
  const thresholdDate = archiveThresholdDate(now);
  const where = ELIGIBLE_WHERE(thresholdDate);

  const [agg, oldest, newest] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _count: { _all: true },
      _sum: { subtotal: true },
    }),
    prisma.sale.findFirst({
      where,
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.sale.findFirst({
      where,
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    thresholdDate,
    ageYears: ARCHIVE_AGE_YEARS,
    eligibleCount: agg._count._all,
    oldestDate: oldest?.createdAt ?? null,
    newestDate: newest?.createdAt ?? null,
    grossValue: agg._sum.subtotal ?? 0,
  };
}

/** Ringkasan kondisi arsip saat ini (untuk panel status di Setelan). */
export async function getArchiveStats(): Promise<ArchiveStats> {
  const [archivedAgg, exportedCount] = await Promise.all([
    prisma.sale.aggregate({
      where: { archivedAt: { not: null } },
      _count: { _all: true },
      _sum: { subtotal: true },
    }),
    prisma.sale.count({
      where: { archivedAt: { not: null }, exportedAt: { not: null } },
    }),
  ]);

  const archivedCount = archivedAgg._count._all;

  return {
    archivedCount,
    archivedGrossValue: archivedAgg._sum.subtotal ?? 0,
    exportedCount,
    notExportedCount: archivedCount - exportedCount,
  };
}

/**
 * TAHAP 1 — Arsipkan semua transaksi yang sudah layak (umur >= 3 tahun &
 * belum diarsip). Hanya memberi penanda `archivedAt`; tidak menghapus apa pun
 * dan tidak mengubah angka mana pun.
 */
export async function archiveOldSales(now = new Date()): Promise<{ archived: number }> {
  const thresholdDate = archiveThresholdDate(now);

  const result = await prisma.sale.updateMany({
    where: ELIGIBLE_WHERE(thresholdDate),
    data: { archivedAt: now },
  });

  return { archived: result.count };
}

export type ArchivedSaleExportRow = {
  invoiceNumber: string;
  createdAt: Date;
  customerName: string;
  cashierName: string;
  paymentMethod: string;
  transactionStatus: string;
  paymentStatus: string;
  subtotal: number;
  paidAmount: number;
  items: {
    productName: string;
    sku: string;
    qty: number;
    price: number;
    subtotal: number;
  }[];
};

/**
 * TAHAP 2 — Ambil seluruh transaksi yang ADA DI ARSIP (archivedAt terisi),
 * lengkap dengan rincian itemnya, untuk diekspor ke file. File inilah pegangan
 * owner sebelum boleh menghapus permanen.
 */
export async function getArchivedSalesForExport(): Promise<ArchivedSaleExportRow[]> {
  const sales = await prisma.sale.findMany({
    where: { archivedAt: { not: null } },
    orderBy: { createdAt: "asc" },
    select: {
      invoiceNumber: true,
      createdAt: true,
      paymentMethod: true,
      transactionStatus: true,
      paymentStatus: true,
      subtotal: true,
      paidAmount: true,
      customer: { select: { name: true } },
      cashier: { select: { name: true } },
      items: {
        select: {
          qty: true,
          price: true,
          subtotal: true,
          product: { select: { name: true, sku: true } },
        },
      },
    },
  });

  return sales.map((sale) => ({
    invoiceNumber: sale.invoiceNumber,
    createdAt: sale.createdAt,
    customerName: sale.customer?.name ?? "Walk-in",
    cashierName: sale.cashier?.name ?? "-",
    paymentMethod: sale.paymentMethod,
    transactionStatus: sale.transactionStatus,
    paymentStatus: sale.paymentStatus,
    subtotal: sale.subtotal,
    paidAmount: sale.paidAmount,
    items: sale.items.map((item) => ({
      productName: item.product?.name ?? "-",
      sku: item.product?.sku ?? "-",
      qty: item.qty,
      price: item.price,
      subtotal: item.subtotal,
    })),
  }));
}

/**
 * TAHAP 2 — Tandai semua arsip sebagai SUDAH DIEKSPOR (exportedAt = now).
 * Dipanggil hanya setelah file ekspor berhasil dibuat. Penanda ini yang membuka
 * kunci tombol Hapus Permanen (Tahap 3). Tidak mengubah angka apa pun.
 */
export async function markArchivedExported(
  now = new Date(),
): Promise<{ exported: number }> {
  const result = await prisma.sale.updateMany({
    where: { archivedAt: { not: null } },
    data: { exportedAt: now },
  });

  return { exported: result.count };
}

/** Transaksi yang BOLEH dihapus permanen: sudah diarsip DAN sudah diekspor. */
const DELETABLE_WHERE = {
  archivedAt: { not: null },
  exportedAt: { not: null },
} as const;

/**
 * TAHAP 3 — Hapus permanen seluruh arsip yang sudah diekspor.
 *
 * KALIBRASI (data selalu valid): satu-satunya angka yang terpengaruh penghapusan
 * adalah agregat "sepanjang masa" pada loyalty & total belanja pelanggan. Maka
 * SEBELUM menghapus, jumlah & nilai transaksi FINAL per pelanggan disimpan ke
 * Customer.archivedSalesCount/Spend. Semua dijalankan dalam SATU transaksi DB:
 * bila ada yang gagal, tidak ada yang terhapus (aman). Snapshot laporan harian
 * (DailyClosing) tidak terpengaruh karena menyimpan angka sendiri.
 */
export async function deleteExportedArchive(): Promise<{ deleted: number }> {
  return prisma.$transaction(
    async (tx) => {
      const targets = await tx.sale.findMany({
        where: DELETABLE_WHERE,
        select: { id: true },
      });
      const ids = targets.map((sale) => sale.id);

      if (ids.length === 0) {
        return { deleted: 0 };
      }

      // 1) KALIBRASI LOYALTY — simpan rekap transaksi FINAL per pelanggan dulu.
      const finalByCustomer = await tx.sale.groupBy({
        by: ["customerId"],
        where: {
          id: { in: ids },
          customerId: { not: null },
          ...FINAL_SALE_STATUS_WHERE,
        },
        _count: { _all: true },
        _sum: { subtotal: true },
      });

      for (const row of finalByCustomer) {
        if (row.customerId == null) {
          continue;
        }

        await tx.customer.update({
          where: { id: row.customerId },
          data: {
            archivedSalesCount: { increment: row._count._all },
            archivedSalesSpend: { increment: row._sum.subtotal ?? 0 },
          },
        });
      }

      // 2) Kumpulkan anak-anak relasi yang harus dihapus lebih dulu.
      const saleItems = await tx.saleItem.findMany({
        where: { saleId: { in: ids } },
        select: { id: true },
      });
      const saleItemIds = saleItems.map((item) => item.id);
      const saleReturns = await tx.saleReturn.findMany({
        where: { saleId: { in: ids } },
        select: { id: true },
      });
      const saleReturnIds = saleReturns.map((ret) => ret.id);

      // 3) Hapus dari anak → induk supaya tidak melanggar foreign key.
      const stockMovementOr: { saleId?: { in: string[] }; saleItemId?: { in: string[] } }[] = [
        { saleId: { in: ids } },
      ];
      if (saleItemIds.length > 0) {
        stockMovementOr.push({ saleItemId: { in: saleItemIds } });
      }
      await tx.stockMovement.deleteMany({ where: { OR: stockMovementOr } });

      const returnItemOr: { returnId?: { in: string[] }; saleItemId?: { in: string[] } }[] = [];
      if (saleReturnIds.length > 0) {
        returnItemOr.push({ returnId: { in: saleReturnIds } });
      }
      if (saleItemIds.length > 0) {
        returnItemOr.push({ saleItemId: { in: saleItemIds } });
      }
      if (returnItemOr.length > 0) {
        await tx.saleReturnItem.deleteMany({ where: { OR: returnItemOr } });
      }

      await tx.saleReturn.deleteMany({ where: { saleId: { in: ids } } });
      await tx.saleItem.deleteMany({ where: { saleId: { in: ids } } });
      // Histori pesan (WA dll) dipertahankan, cukup lepaskan tautannya ke sale.
      await tx.messageLog.updateMany({
        where: { relatedSaleId: { in: ids } },
        data: { relatedSaleId: null },
      });

      const result = await tx.sale.deleteMany({ where: { id: { in: ids } } });

      return { deleted: result.count };
    },
    { timeout: 120_000, maxWait: 15_000 },
  );
}
