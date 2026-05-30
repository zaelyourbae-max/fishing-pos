import { requireOwner } from "@/lib/auth-session";
import { getOwnerReportSummary } from "@/lib/reports";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    data: await getOwnerReportSummary(),
  });
}
