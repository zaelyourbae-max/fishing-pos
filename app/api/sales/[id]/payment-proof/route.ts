import { requireCashier } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { PaymentStatus, Prisma, TransactionStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const MAX_SIZE = 3 * 1024 * 1024;

function canAccessSale(role: string | null, userId: number) {
  return role === "cashier" ? { cashierId: userId } : {};
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

  const extension = ALLOWED_TYPES.get(file.type);

  if (!extension) {
    return NextResponse.json(
      { message: "Bukti pembayaran harus berupa JPG, PNG, atau WEBP." },
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

  const uploadDir = join(process.cwd(), "public", "uploads", "payment-proofs");
  await mkdir(uploadDir, { recursive: true });

  const filename = `qris-proof-${sale.id}-${randomUUID()}.${extension}`;
  const diskPath = join(uploadDir, filename);
  await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));
  const proofUrl = `/uploads/payment-proofs/${filename}`;

  const updatedSale = await prisma.$transaction(
    async (tx) =>
      tx.sale.update({
        where: {
          id: sale.id,
        },
        data: {
          paymentProofUrl: proofUrl,
          paymentProofUploadedAt: new Date(),
          paymentProofUploadedById: auth.session.sub,
          paymentStatus: PaymentStatus.PAID,
          transactionStatus: TransactionStatus.SUCCESS,
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
      }),
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
