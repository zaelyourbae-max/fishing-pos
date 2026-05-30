import { requireCashier } from "@/lib/auth-session";
import { getStockOpnameDetail } from "@/lib/stock-opname";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = await requireCashier(request);

  if (!auth.ok) {
    return auth.response;
  }

  const params = await context.params;
  const session = await getStockOpnameDetail(params.id);

  if (!session) {
    return NextResponse.json(
      { message: "Sesi Stock Opname tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: session });
}
