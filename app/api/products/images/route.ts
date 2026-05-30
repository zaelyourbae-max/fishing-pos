import { requireOwner } from "@/lib/auth-session";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import { NextResponse } from "next/server";

const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const MIME_EXTENSION = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        message: "File foto produk wajib diisi.",
      },
      {
        status: 422,
      },
    );
  }

  const extension = MIME_EXTENSION.get(file.type);

  if (!extension) {
    return NextResponse.json(
      {
        message: "File harus berupa gambar JPG, PNG, WEBP, atau GIF.",
      },
      {
        status: 422,
      },
    );
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return NextResponse.json(
      {
        message: "Ukuran foto maksimal 3 MB.",
      },
      {
        status: 422,
      },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.${extension}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "products");
  const target = path.join(uploadDir, filename);

  await mkdir(uploadDir, {
    recursive: true,
  });
  await writeFile(target, bytes);

  return NextResponse.json({
    data: {
      imageUrl: `/uploads/products/${filename}`,
    },
  });
}
