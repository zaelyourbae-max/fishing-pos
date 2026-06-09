import { requireOwner } from "@/lib/auth-session";
import {
  archiveOldSales,
  getArchivePreview,
  getArchiveStats,
} from "@/lib/archive";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** GET: pratinjau (apa yang akan diarsip) + status arsip saat ini. */
export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const [preview, stats] = await Promise.all([
    getArchivePreview(),
    getArchiveStats(),
  ]);

  return NextResponse.json({ data: { preview, stats } });
}

/** POST: TAHAP 1 — arsipkan transaksi lama yang sudah layak. */
export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const result = await archiveOldSales();
  const [preview, stats] = await Promise.all([
    getArchivePreview(),
    getArchiveStats(),
  ]);

  return NextResponse.json({
    data: { archived: result.archived, preview, stats },
  });
}
