import { requireCashier } from "@/lib/auth-session";
import { getQrisImageSource } from "@/lib/payments";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/;

function imageResponse(dataUrl: string) {
  const match = dataUrl.match(DATA_URL_PATTERN);

  if (!match) {
    return null;
  }

  const [, contentType, base64] = match;
  const body = Buffer.from(base64, "base64");

  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": String(body.length),
      "Content-Type": contentType,
    },
  });
}

export async function GET(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { qrisImageUrl, qrisImageDataUrl } = await getQrisImageSource();
  const imageUrl = qrisImageUrl.trim();

  if (!imageUrl) {
    return NextResponse.json(
      { message: "QRIS belum tersedia." },
      { status: 404 },
    );
  }

  if (imageUrl.startsWith("/api/payment-settings/qris-image")) {
    const response = imageResponse(qrisImageDataUrl);

    if (response) {
      return response;
    }

    return NextResponse.json(
      { message: "QRIS tidak valid atau belum tersedia." },
      { status: 404 },
    );
  }

  if (imageUrl.startsWith("data:")) {
    const response = imageResponse(imageUrl);

    if (response) {
      return response;
    }
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return NextResponse.redirect(imageUrl);
  }

  if (imageUrl.startsWith("/")) {
    return NextResponse.redirect(new URL(imageUrl, req.url));
  }

  return NextResponse.json(
    { message: "QRIS tidak valid atau belum tersedia." },
    { status: 404 },
  );
}
