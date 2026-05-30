import { prisma } from "@/lib/prisma";
import { PaymentStatus, Prisma, TransactionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const BATCH_SIZE = 50;
const AUTO_EXPIRE_REASON = "AUTO_EXPIRED_PENDING_PAYMENT_15_MINUTES";

async function expireSale(saleId: string, now: Date) {
  return prisma.$transaction(
    async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        select: {
          id: true,
          invoiceNumber: true,
          transactionStatus: true,
          paymentStatus: true,
          expiredAt: true,
          items: {
            select: { id: true, productId: true, qty: true },
            orderBy: { id: "asc" },
          },
        },
      });

      if (
        !sale ||
        sale.transactionStatus !== TransactionStatus.PENDING ||
        (sale.paymentStatus !== PaymentStatus.WAITING_PROOF &&
          sale.paymentStatus !== PaymentStatus.UNPAID) ||
        !sale.expiredAt ||
        sale.expiredAt.getTime() > now.getTime()
      ) {
        return false;
      }

      const update = await tx.sale.updateMany({
        where: {
          id: sale.id,
          transactionStatus: TransactionStatus.PENDING,
          paymentStatus: { in: [PaymentStatus.WAITING_PROOF, PaymentStatus.UNPAID] },
          expiredAt: { lt: now },
        },
        data: {
          transactionStatus: TransactionStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
          cancelReason: AUTO_EXPIRE_REASON,
          cancelledAt: now,
        },
      });

      if (update.count !== 1) return false;

      for (const item of sale.items) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.qty } },
          select: { stock: true },
        });
        const stockAfter = product.stock;
        const stockBefore = stockAfter - item.qty;

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            saleId: sale.id,
            saleItemId: item.id,
            type: "SALE_AUTO_EXPIRE_RESTORE",
            qty: item.qty,
            stockBefore,
            stockAfter,
            reference: sale.invoiceNumber,
            notes: "Auto expire pending payment 15 menit",
          },
        });
      }

      return true;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let checked = 0;
  let expired = 0;
  let skipped = 0;

  while (true) {
    const now = new Date();
    const sales = await prisma.sale.findMany({
      where: {
        transactionStatus: TransactionStatus.PENDING,
        paymentStatus: { in: [PaymentStatus.WAITING_PROOF, PaymentStatus.UNPAID] },
        expiredAt: { lt: now },
      },
      select: { id: true },
      orderBy: { expiredAt: "asc" },
      take: BATCH_SIZE,
    });

    if (sales.length === 0) break;

    checked += sales.length;

    for (const sale of sales) {
      const ok = await expireSale(sale.id, now);
      if (ok) expired += 1;
      else skipped += 1;
    }

    if (sales.length < BATCH_SIZE) break;
  }

  return NextResponse.json({ ok: true, checked, expired, skipped });
}
