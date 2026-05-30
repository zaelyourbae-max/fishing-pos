import { isOwnerRole, requireCashier } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, Prisma, TransactionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const cancelReason = String(body.cancel_reason ?? body.cancelReason ?? "").trim();

  if (cancelReason.length < 5) {
    return NextResponse.json(
      { message: "Alasan pembatalan wajib diisi minimal 5 karakter." },
      { status: 422 },
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const sale = await tx.sale.findFirst({
          where: {
            id,
            ...(isOwnerRole(auth.session.role)
              ? {}
              : { cashierId: auth.session.sub }),
          },
          select: {
            id: true,
            invoiceNumber: true,
            cashierId: true,
            transactionStatus: true,
            paymentStatus: true,
            items: {
              select: {
                id: true,
                productId: true,
                qty: true,
                product: {
                  select: {
                    id: true,
                    stock: true,
                  },
                },
              },
              orderBy: {
                id: "asc",
              },
            },
          },
        });

        if (!sale) {
          throw new Error("SALE_NOT_FOUND");
        }

        if (sale.transactionStatus === TransactionStatus.CANCELLED) {
          throw new Error("SALE_ALREADY_CANCELLED");
        }

        if (sale.transactionStatus !== TransactionStatus.PENDING) {
          throw new Error("SALE_NOT_CANCELLABLE");
        }

        const cancelledAt = new Date();
        const runningStock = new Map(
          sale.items.map((item) => [item.productId, item.product.stock]),
        );

        for (const item of sale.items) {
          const stockBefore = runningStock.get(item.productId) ?? item.product.stock;
          const stockAfter = stockBefore + item.qty;
          runningStock.set(item.productId, stockAfter);

          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              stock: {
                increment: item.qty,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              saleId: sale.id,
              saleItemId: item.id,
              createdById: auth.session.sub,
              type: "SALE_CANCEL_RESTORE",
              qty: item.qty,
              stockBefore,
              stockAfter,
              reference: sale.invoiceNumber,
              notes: `Pembatalan transaksi: ${cancelReason}`,
            },
          });
        }

        const updatedSale = await tx.sale.update({
          where: {
            id: sale.id,
          },
          data: {
            transactionStatus: TransactionStatus.CANCELLED,
            paymentStatus: PaymentStatus.FAILED,
            cancelReason,
            cancelledAt,
            cancelledById: auth.session.sub,
          },
          select: {
            id: true,
            invoiceNumber: true,
            transactionStatus: true,
            paymentStatus: true,
            cancelReason: true,
            cancelledAt: true,
            cancelledBy: {
              select: {
                name: true,
              },
            },
          },
        });

        return updatedSale;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/sales");
    revalidatePath("/dashboard");
    revalidatePath("/cashier");
    revalidatePath("/pos");
    revalidatePath(`/invoices/${result.id}`);

    return NextResponse.json({
      data: {
        id: result.id,
        invoice_number: result.invoiceNumber,
        transaction_status: result.transactionStatus,
        payment_status: result.paymentStatus,
        cancel_reason: result.cancelReason,
        cancelled_at: result.cancelledAt,
        cancelled_by: result.cancelledBy?.name ?? null,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "SALE_NOT_FOUND") {
        return NextResponse.json(
          { message: "Transaksi tidak ditemukan atau tidak bisa diakses." },
          { status: 404 },
        );
      }

      if (error.message === "SALE_ALREADY_CANCELLED") {
        return NextResponse.json(
          { message: "Transaksi sudah dibatalkan." },
          { status: 409 },
        );
      }

      if (error.message === "SALE_NOT_CANCELLABLE") {
        return NextResponse.json(
          { message: "Hanya transaksi PENDING yang bisa dibatalkan pada fase ini." },
          { status: 422 },
        );
      }
    }

    console.error(error);

    return NextResponse.json(
      { message: "Gagal membatalkan transaksi." },
      { status: 500 },
    );
  }
}
