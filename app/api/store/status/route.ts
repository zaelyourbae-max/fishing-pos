import { requireCashier } from "@/lib/auth-session";
import { getStoreStatus } from "@/lib/store-status";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const status = await getStoreStatus();

  return NextResponse.json({ data: status });
}
