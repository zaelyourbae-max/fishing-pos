import { requireCashier } from "@/lib/auth-session";
import {
  findSaleForMessage,
  saleMessagePayload,
} from "@/lib/message-actions";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  const sale = await findSaleForMessage(id, auth.session);

  if (!sale) {
    return NextResponse.json(
      { message: "Transaksi tidak ditemukan atau tidak bisa diakses." },
      { status: 404 },
    );
  }

  if (!sale.customer?.phone) {
    return NextResponse.json(
      { message: "Nomor WhatsApp customer belum tersedia." },
      { status: 400 },
    );
  }

  const payload = saleMessagePayload(sale);
  const messageLog = await prisma.messageLog.create({
    data: {
      type: "INVOICE_CUSTOMER",
      targetType: "CUSTOMER",
      targetPhone: sale.customer.phone,
      targetName: sale.customer.name,
      status: "READY",
      provider: "N8N_FUTURE",
      relatedSaleId: sale.id,
      createdById: auth.session.sub,
      payload,
    },
    select: {
      id: true,
      status: true,
      type: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    message: "Nota customer siap dikirim saat integrasi WhatsApp aktif.",
    data: messageLog,
  });
}
