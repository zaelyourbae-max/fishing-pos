import { requireOwner } from "@/lib/auth-session";
import {
  cancelStockOpname,
  stockOpnameErrorPayload,
} from "@/lib/stock-opname";
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
    const body = await request.json().catch(() => ({}));
    await cancelStockOpname({
      sessionId: params.id,
      userId: auth.session.sub,
      reason: body.reason,
    });

    revalidatePath("/stock-opname");
    revalidatePath(`/stock-opname/${params.id}`);

    return NextResponse.json({
      message: "Sesi Stock Opname dibatalkan.",
    });
  } catch (error) {
    const payload = stockOpnameErrorPayload(error);

    return NextResponse.json(payload, { status: payload.status });
  }
}
