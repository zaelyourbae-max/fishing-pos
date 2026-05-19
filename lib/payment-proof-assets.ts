import { prisma } from "@/lib/prisma";

const PAYMENT_PROOF_DATA_PREFIX = "paymentProofData:";
const IMAGE_DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/;

export function paymentProofDataKey(saleId: string) {
  return `${PAYMENT_PROOF_DATA_PREFIX}${saleId}`;
}

export function paymentProofEndpoint(saleId: string, cacheKey?: string) {
  const base = `/api/sales/${saleId}/payment-proof`;

  return cacheKey ? `${base}?v=${encodeURIComponent(cacheKey)}` : base;
}

export async function getPaymentProofDataUrl(saleId: string) {
  const row = await prisma.paymentSetting.findUnique({
    where: {
      key: paymentProofDataKey(saleId),
    },
    select: {
      value: true,
    },
  });

  return row?.value ?? "";
}

export function dataUrlImageResponse(dataUrl: string) {
  const match = dataUrl.match(IMAGE_DATA_URL_PATTERN);

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
