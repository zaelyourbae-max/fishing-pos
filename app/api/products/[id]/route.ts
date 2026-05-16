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

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = requireOwner(request);

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
    const name = String(body.name ?? "").trim();
    const price = positiveInteger(body.price);
    const stock = positiveInteger(body.stock);
    const costPrice = positiveInteger(body.costPrice ?? 0);
    const minStock = positiveInteger(body.minStock ?? 0);
    const imageUrl =
      body.imageUrl === undefined
        ? undefined
        : readImageUrl(body.imageUrl);

    if (!name || price === null || stock === null || costPrice === null || minStock === null) {
      return NextResponse.json(
        {
          message: "Nama, harga, stok, harga beli, dan min stok harus valid.",
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
          },
        });

        if (!existing) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const product = await tx.product.update({
          where: {
            id: productId,
          },
          data: {
            sku: body.sku ? String(body.sku).trim().toUpperCase() : null,
            barcode: body.barcode ? String(body.barcode).trim().toUpperCase() : null,
            name,
            description: body.description ? String(body.description).trim() : null,
            price,
            costPrice,
            stock,
            minStock,
            unit: body.unit ? String(body.unit).trim() : "pcs",
            category: body.category ? String(body.category).trim() : null,
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
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ message: "Produk tidak ditemukan." }, { status: 404 });
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
  const auth = requireOwner(request);

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
