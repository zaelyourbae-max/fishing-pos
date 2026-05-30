import { requireCashier } from "@/lib/auth-session";
import {
  applyStockOpnameImportRows,
  stockOpnameErrorPayload,
  type StockOpnameImportInput,
} from "@/lib/stock-opname";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

type ApplyBody = {
  rows?: StockOpnameImportInput[];
};

export async function POST(
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

  try {
    const body = (await request.json()) as ApplyBody;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const result = await applyStockOpnameImportRows({
      sessionId: params.id,
      rows,
      userId: auth.session.sub,
    });

    revalidatePath(`/stock-opname/${params.id}`);

    return NextResponse.json({
      message: "Hasil hitung fisik berhasil diimport ke sesi SO.",
      data: result,
    });
  } catch (error) {
    const payload = stockOpnameErrorPayload(error);

    return NextResponse.json(payload, { status: payload.status });
  }
}
