import {
  PaymentStatus,
  Prisma,
  PrismaClient,
  TransactionStatus,
} from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 50;
const AUTO_EXPIRE_REASON = "AUTO_EXPIRED_PENDING_PAYMENT_15_MINUTES";

type ExpireResult = {
  checked: number;
  expired: number;
  skipped: number;
};

async function expireSale(saleId: string, now: Date) {
  return prisma.$transaction(
    async (tx) => {
      const sale = await tx.sale.findUnique({
        where: {
          id: saleId,
        },
        select: {
          id: true,
          invoiceNumber: true,
          transactionStatus: true,
          paymentStatus: true,
          expiredAt: true,
          items: {
            select: {
              id: true,
              productId: true,
              qty: true,
            },
            orderBy: {
              id: "asc",
            },
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
          paymentStatus: {
            in: [PaymentStatus.WAITING_PROOF, PaymentStatus.UNPAID],
          },
          expiredAt: {
            lt: now,
          },
        },
        data: {
          transactionStatus: TransactionStatus.CANCELLED,
          paymentStatus: PaymentStatus.FAILED,
          cancelReason: AUTO_EXPIRE_REASON,
          cancelledAt: now,
        },
      });

      if (update.count !== 1) {
        return false;
      }

      for (const item of sale.items) {
        const product = await tx.product.update({
          where: {
            id: item.productId,
          },
          data: {
            stock: {
              increment: item.qty,
            },
          },
          select: {
            stock: true,
          },
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
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

async function expirePendingSales() {
  const result: ExpireResult = {
    checked: 0,
    expired: 0,
    skipped: 0,
  };

  while (true) {
    const now = new Date();
    const sales = await prisma.sale.findMany({
      where: {
        transactionStatus: TransactionStatus.PENDING,
        paymentStatus: {
          in: [PaymentStatus.WAITING_PROOF, PaymentStatus.UNPAID],
        },
        expiredAt: {
          lt: now,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        expiredAt: "asc",
      },
      take: BATCH_SIZE,
    });

    if (sales.length === 0) {
      break;
    }

    result.checked += sales.length;

    for (const sale of sales) {
      const expired = await expireSale(sale.id, now);

      if (expired) {
        result.expired += 1;
      } else {
        result.skipped += 1;
      }
    }

    if (sales.length < BATCH_SIZE) {
      break;
    }
  }

  return result;
}

expirePendingSales()
  .then((result) => {
    console.log(
      JSON.stringify(
        {
          ok: true,
          ...result,
        },
        null,
        2,
      ),
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
