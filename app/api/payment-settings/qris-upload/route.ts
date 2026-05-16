import { requireOwner } from "@/lib/auth-session";
import { updatePaymentSettings } from "@/lib/payments";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024;

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  return "bin";
}

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
      { message: "File QRIS harus PNG, JPG, atau WEBP." },
      { status: 422 },
    );
  }

  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { message: "Ukuran file QRIS maksimal 2MB." },
      { status: 422 },
    );
  }

  const uploadDir = join(process.cwd(), "public", "uploads", "qris");
  await mkdir(uploadDir, { recursive: true });

  const filename = `qris-${randomUUID()}.${extensionFor(file.type)}`;
  const diskPath = join(uploadDir, filename);
  await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));

  const imageUrl = `/uploads/qris/${filename}`;
  const settings = await updatePaymentSettings({
    qrisImageUrl: imageUrl,
  });

  return NextResponse.json({
    data: {
      qrisImageUrl: settings.qrisImageUrl,
    },
  });
}
