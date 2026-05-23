import { requireCashier } from "@/lib/auth-session";
import {
  dataUrlImageResponse,
  getPaymentProofDataUrl,
  paymentProofDataKey,
  paymentProofEndpoint,
} from "@/lib/payment-proof-assets";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, Prisma, TransactionStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_SIZE = 3 * 1024 * 1024;

function canAccessSale(role: string | null, userId: number) {
  return role === "cashier" ? { cashierId: userId } : {};
}

export async function GET(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const sale = await prisma.sale.findFirst({
    where: {
      id,
      ...canAccessSale(auth.session.role, auth.session.sub),
    },
    select: {
      id: true,
      paymentProofUrl: true,
    },
  });

  if (!sale?.paymentProofUrl) {
    return NextResponse.json(
      { message: "Bukti pembayaran tidak tersedia." },
      { status: 404 },
    );
  }

  const storedProof = await getPaymentProofDataUrl(sale.id);
  const storedResponse = dataUrlImageResponse(storedProof);

  if (storedResponse) {
    return storedResponse;
  }

  const proofUrl = sale.paymentProofUrl.trim();
  const inlineResponse = dataUrlImageResponse(proofUrl);

  if (inlineResponse) {
    return inlineResponse;
  }

  if (proofUrl.startsWith("http://") || proofUrl.startsWith("https://")) {
    return NextResponse.redirect(proofUrl);
  }

  if (proofUrl.startsWith("/")) {
    return NextResponse.redirect(new URL(proofUrl, req.url));
  }

  return NextResponse.json(
    { message: "Bukti pembayaran tidak tersedia atau gagal dimuat." },
    { status: 404 },
  );
}

export async function POST(
  req: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await context.params;
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: "Bukti pembayaran wajib diupload." },
      { status: 422 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { message: "Bukti pembayaran harus berupa JPG, JPEG, atau PNG." },
      { status: 422 },
    );
  }

  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { message: "Ukuran bukti pembayaran maksimal 3 MB." },
      { status: 422 },
    );
  }

  const sale = await prisma.sale.findFirst({
    where: {
      id,
      ...canAccessSale(auth.session.role, auth.session.sub),
    },
    select: {
      id: true,
      invoiceNumber: true,
      paymentMethod: true,
      transactionStatus: true,
      paymentStatus: true,
      expiredAt: true,
    },
  });

  if (!sale) {
    return NextResponse.json(
      { message: "Transaksi tidak ditemukan atau tidak bisa diakses." },
      { status: 404 },
    );
  }

  if (!sale.paymentMethod.toUpperCase().includes("QRIS")) {
    return NextResponse.json(
      { message: "Upload bukti pembayaran hanya tersedia untuk QRIS." },
      { status: 422 },
    );
  }

  if (sale.transactionStatus === TransactionStatus.CANCELLED) {
    return NextResponse.json(
      { message: "Transaksi cancelled tidak bisa menerima bukti pembayaran." },
      { status: 409 },
    );
  }

  if (
    sale.transactionStatus !== TransactionStatus.PENDING ||
    sale.paymentStatus !== PaymentStatus.WAITING_PROOF
  ) {
    return NextResponse.json(
      { message: "Upload bukti hanya tersedia untuk transaksi QRIS pending." },
      { status: 409 },
    );
  }

  if (sale.expiredAt && sale.expiredAt.getTime() <= Date.now()) {
    return NextResponse.json(
      {
        message:
          "Transaksi pending sudah melewati batas 15 menit. Jalankan auto-expire atau buat transaksi baru.",
      },
      { status: 409 },
    );
  }

  const imageBuffer = Buffer.from(await file.arrayBuffer());
  const proofDataUrl = `data:${file.type};base64,${imageBuffer.toString("base64")}`;
  const proofUrl = paymentProofEndpoint(sale.id, randomUUID());

  const updatedSale = await prisma.$transaction(
    async (tx) => {
      await tx.paymentSetting.upsert({
        where: {
          key: paymentProofDataKey(sale.id),
        },
        update: {
          value: proofDataUrl,
        },
        create: {
          key: paymentProofDataKey(sale.id),
          value: proofDataUrl,
        },
      });

      return tx.sale.update({
        where: {
          id: sale.id,
        },
        data: {
          paymentProofUrl: proofUrl,
          paymentProofUploadedAt: new Date(),
          paymentProofUploadedById: auth.session.sub,
          paymentStatus: PaymentStatus.PAID,
          transactionStatus: TransactionStatus.SUCCESS,
          expiredAt: null,
        },
        select: {
          id: true,
          invoiceNumber: true,
          paymentMethod: true,
          paymentProofUrl: true,
          paymentProofUploadedAt: true,
          transactionStatus: true,
          paymentStatus: true,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  return NextResponse.json({
    data: {
      id: updatedSale.id,
      invoice_number: updatedSale.invoiceNumber,
      payment_method: updatedSale.paymentMethod,
      payment_proof_url: updatedSale.paymentProofUrl,
      payment_proof_uploaded_at: updatedSale.paymentProofUploadedAt,
      transaction_status: updatedSale.transactionStatus,
      payment_status: updatedSale.paymentStatus,
    },
  });
}
