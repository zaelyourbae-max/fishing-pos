import { requireOwner } from "@/lib/auth-session";
import {
  parsePhysicalStock,
  stockOpnameErrorPayload,
  updateStockOpnameItemPhysicalStock,
} from "@/lib/stock-opname";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string; itemId: string }>;
  },
) {
  const auth = await requireOwner(request);

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;

  try {
    const body = await request.json();
    const physicalStock = parsePhysicalStock(body.physicalStock);

    if (physicalStock === null) {
      return NextResponse.json(
        { message: "Stok fisik wajib angka bulat >= 0." },
        { status: 422 },
      );
    }

    const item = await updateStockOpnameItemPhysicalStock({
      sessionId: params.id,
      itemId: params.itemId,
      physicalStock,
      notes: body.notes,
      userId: auth.session.sub,
    });

    revalidatePath(`/stock-opname/${params.id}`);

    return NextResponse.json({
      message: "Stok fisik berhasil diperbarui.",
      data: item,
    });
  } catch (error) {
    const payload = stockOpnameErrorPayload(error);

    return NextResponse.json(payload, { status: payload.status });
  }
}
