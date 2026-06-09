import { requireOwner } from "@/lib/auth-session";
import {
  deleteExportedArchive,
  getArchivePreview,
  getArchiveStats,
} from "@/lib/archive";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * TAHAP 3 — POST: hapus permanen arsip yang SUDAH diekspor.
 * Wajib mengirim { confirm: true } di body sebagai pengaman dari panggilan
 * tak sengaja. Hanya menghapus yang exportedAt-nya terisi (server-side guard).
 */
export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json().catch(() => ({}));

  if (body?.confirm !== true) {
    return NextResponse.json(
      { message: "Konfirmasi penghapusan diperlukan." },
      { status: 422 },
    );
  }

  const stats = await getArchiveStats();

  if (stats.exportedCount === 0) {
    return NextResponse.json(
      {
        message:
          "Tidak ada arsip yang siap dihapus. Arsip harus diekspor lebih dulu.",
      },
      { status: 422 },
    );
  }

  const result = await deleteExportedArchive();
  const [preview, freshStats] = await Promise.all([
    getArchivePreview(),
    getArchiveStats(),
  ]);

  return NextResponse.json({
    data: { deleted: result.deleted, preview, stats: freshStats },
  });
}
