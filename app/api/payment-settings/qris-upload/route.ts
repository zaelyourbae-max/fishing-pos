import { requireOwner } from "@/lib/auth-session";
import { updateQrisImage } from "@/lib/payments";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "File QRIS wajib diupload." },
      { status: 422 },
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { message: "File QRIS harus PNG, JPG, atau JPEG." },
      { status: 422 },
    );
  }

  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { message: "Ukuran file QRIS maksimal 2MB." },
      { status: 422 },
    );
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${imageBuffer.toString("base64")}`;
  const settings = await updateQrisImage(dataUrl, randomUUID());

  return NextResponse.json({
    data: {
      qrisImageUrl: settings.qrisImageUrl,
    },
  });
}
