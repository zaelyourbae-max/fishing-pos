import { requireOwner } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { guardStoreOpen } from "@/lib/store-status";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const STOCK_CORRECTION_REASONS = {
  DAMAGED: "Barang rusak",
  LOST: "Barang hilang",
  MISCOUNT: "Salah hitung stok",
  FOUND_BONUS: "Bonus / stok ditemukan",
  OTHER: "Lainnya",
} as const;

type StockCorrectionReason = keyof typeof STOCK_CORRECTION_REASONS;

function positiveInteger(value: unknown) {
  const number = Number(value);

  return Number.isInteger(number) && number >= 0 ? number : null;
}

function readText(value: unknown) {
  const text = String(value ?? "").trim();

  return text ? text : null;
}

function isStockCorrectionReason(value: unknown): value is StockCorrectionReason {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(STOCK_CORRECTION_REASONS, value)
  );
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireOwner(request);

  if (!auth.ok) {
    return auth.response;
  }

  const storeClosed = await guardStoreOpen();

  if (storeClosed) {
    return storeClosed;
  }

  const params = await context.params;
  const productId = Number(params.id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ message: "ID produk tidak valid." }, { status: 422 });
  }

  try {
    const body = await request.json();
    const physicalStock = positiveInteger(body.physicalStock);
    const reason = body.reason;
    const notes = readText(body.notes);

    if (physicalStock === null || !isStockCorrectionReason(reason)) {
      return NextResponse.json(
        { message: "Stok fisik dan alasan koreksi wajib diisi dengan benar." },
        { status: 422 },
      );
    }

    if (reason === "OTHER" && !notes) {
      return NextResponse.json(
        { message: "Catatan wajib diisi jika alasan koreksi adalah Lainnya." },
        { status: 422 },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const product = await tx.product.findUnique({
          where: {
            id: productId,
          },
          select: {
            id: true,
            name: true,
            stock: true,
          },
        });

        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        if (product.stock === physicalStock) {
          throw new Error("NO_STOCK_CHANGE");
        }

        const delta = physicalStock - product.stock;
        const reference = `STOCK-CORRECTION-${productId}-${Date.now()}`;
        const reasonLabel = STOCK_CORRECTION_REASONS[reason];

        const updatedProduct = await tx.product.update({
          where: {
            id: productId,
          },
          data: {
            stock: physicalStock,
          },
          select: {
            id: true,
            name: true,
            stock: true,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId,
            createdById: auth.session.sub,
            type: "ADJUSTMENT",
            qty: delta,
            stockBefore: product.stock,
            stockAfter: physicalStock,
            reference,
            notes: `Koreksi stok: ${reasonLabel}${notes ? ` - ${notes}` : ""}`,
          },
        });

        return {
          product: updatedProduct,
          stockBefore: product.stock,
          stockAfter: physicalStock,
          qty: delta,
          reference,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/reports");

    return NextResponse.json({
      message: "Koreksi stok berhasil disimpan.",
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "Produk tidak ditemukan." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "NO_STOCK_CHANGE") {
      return NextResponse.json(
        { message: "Tidak ada perubahan stok. Stok fisik sama dengan stok sistem." },
        { status: 422 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { message: "Stok sedang berubah. Silakan coba simpan ulang." },
        { status: 409 },
      );
    }

    console.error(error);

    return NextResponse.json(
      { message: "Gagal menyimpan koreksi stok." },
      { status: 500 },
    );
  }
}
