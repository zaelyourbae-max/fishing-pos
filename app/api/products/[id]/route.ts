import { requireOwner } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

function positiveInteger(value: unknown) {
  const number = Number(value);

  return Number.isInteger(number) && number >= 0 ? number : null;
}

function readImageUrl(value: unknown) {
  const imageUrl = String(value ?? "").trim();

  return imageUrl.startsWith("/uploads/products/") ? imageUrl : null;
}

function readOptionalText(value: unknown) {
  const text = String(value ?? "").trim();

  return text ? text : null;
}

function supplierCode() {
  return `SUP-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
}

async function resolveSupplierId(name: string | null) {
  if (!name) {
    return null;
  }

  const existing = await prisma.supplier.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.supplier.create({
    data: {
      code: supplierCode(),
      name,
      type: "SUPPLIER",
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return created.id;
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

  const params = await context.params;
  const productId = Number(params.id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return NextResponse.json({ message: "ID produk tidak valid." }, { status: 422 });
  }

  try {
    const body = await request.json();
    const name = readOptionalText(body.name);
    const category = readOptionalText(body.category);
    const unit = readOptionalText(body.unit);
    const price = positiveInteger(body.price);
    const stock = positiveInteger(body.stock);
    const costPrice = positiveInteger(body.costPrice ?? 0);
    const minStock = positiveInteger(body.minStock ?? 0);
    const supplierName = readOptionalText(body.supplier);
    const imageUrl =
      body.imageUrl === undefined
        ? undefined
        : readImageUrl(body.imageUrl);

    if (
      !name ||
      !category ||
      !unit ||
      price === null ||
      stock === null ||
      costPrice === null ||
      minStock === null
    ) {
      return NextResponse.json(
        {
          message:
            "Field wajib: nama, kategori, unit, harga jual, HPP, stok, dan min stok harus valid.",
        },
        {
          status: 422,
        },
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.product.findUnique({
          where: {
            id: productId,
          },
          select: {
            id: true,
            stock: true,
            _count: {
              select: {
                purchaseItems: true,
                saleItems: true,
                saleReturnItems: true,
                stockMovements: true,
                supplierReturnItems: true,
              },
            },
          },
        });

        if (!existing) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const hasStockHistory =
          existing._count.purchaseItems > 0 ||
          existing._count.saleItems > 0 ||
          existing._count.saleReturnItems > 0 ||
          existing._count.stockMovements > 0 ||
          existing._count.supplierReturnItems > 0;

        if (hasStockHistory && existing.stock !== stock) {
          throw new Error("PRODUCT_STOCK_LOCKED");
        }

        const supplierId = await resolveSupplierId(supplierName);

        const product = await tx.product.update({
          where: {
            id: productId,
          },
          data: {
            sku: body.sku ? String(body.sku).trim().toUpperCase() : null,
            barcode: body.barcode ? String(body.barcode).trim().toUpperCase() : null,
            name,
            category,
            brand: readOptionalText(body.brand),
            variant: readOptionalText(body.variant),
            description: readOptionalText(body.description),
            price,
            costPrice,
            stock: hasStockHistory ? existing.stock : stock,
            minStock,
            unit,
            supplierId,
            ...(imageUrl !== undefined ? { imageUrl } : {}),
          },
        });

        if (existing.stock !== stock) {
          await tx.stockMovement.create({
            data: {
              productId,
              createdById: auth.session.sub,
              type: "ADJUSTMENT",
              qty: stock - existing.stock,
              stockBefore: existing.stock,
              stockAfter: stock,
              reference: `PRODUCT-EDIT-${productId}`,
              notes: "Edit produk: penyesuaian stok manual",
            },
          });
        }

        return product;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/purchases");

    return NextResponse.json({
      message: "Produk berhasil diupdate.",
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");

      if (target.includes("sku")) {
        return NextResponse.json(
          { message: "SKU sudah dipakai produk lain." },
          { status: 422 },
        );
      }

      if (target.includes("barcode")) {
        return NextResponse.json(
          { message: "Barcode sudah dipakai produk lain." },
          { status: 422 },
        );
      }
    }

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "Produk tidak ditemukan." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "PRODUCT_STOCK_LOCKED") {
      return NextResponse.json(
        {
          message:
            "Stok produk lama tidak bisa diubah dari menu Produk. Gunakan menu Pembelian untuk tambah stok barang.",
        },
        { status: 422 },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        message: "Gagal update produk.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const auth = await requireOwner(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = await context.params;

    await prisma.product.update({
      where: {
        id: Number(params.id),
      },
      data: {
        isActive: false,
      },
    });

    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/purchases");

    return NextResponse.json({
      success: true,
      message: "Produk dinonaktifkan. Gunakan restore untuk mengaktifkan kembali.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Gagal menonaktifkan produk",
      },
      {
        status: 500,
      }
    );
  }
}
