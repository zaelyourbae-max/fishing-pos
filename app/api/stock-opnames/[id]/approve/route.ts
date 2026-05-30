import { requireOwner } from "@/lib/auth-session";
import {
  approveStockOpname,
  stockOpnameErrorPayload,
} from "@/lib/stock-opname";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(
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

  try {
    const result = await approveStockOpname({
      sessionId: params.id,
      userId: auth.session.sub,
    });

    revalidatePath("/stock-opname");
    revalidatePath(`/stock-opname/${params.id}`);
    revalidatePath("/products");
    revalidatePath("/pos");
    revalidatePath("/reports");

    return NextResponse.json({
      message: "Stock Opname berhasil di-approve.",
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { message: "Stok sedang berubah. Silakan coba approve ulang." },
        { status: 409 },
      );
    }

    const payload = stockOpnameErrorPayload(error);

    return NextResponse.json(payload, { status: payload.status });
  }
}
