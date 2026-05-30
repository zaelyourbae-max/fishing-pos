import { requireOwner } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

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
    return NextResponse.json(
      {
        message: "ID produk tidak valid.",
      },
      {
        status: 422,
      },
    );
  }

  try {
    const product = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/purchases");

    return NextResponse.json({
      message: "Produk diaktifkan kembali.",
      data: product,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Gagal mengaktifkan kembali produk.",
      },
      {
        status: 500,
      },
    );
  }
}
