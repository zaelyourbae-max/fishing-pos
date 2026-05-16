import { requireCashier } from "@/lib/auth-session";
import {
  findSaleForMessage,
  saleMessagePayload,
} from "@/lib/message-actions";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
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
  const [sale, settings] = await Promise.all([
    findSaleForMessage(id, auth.session),
    getSettings(),
  ]);

  if (!sale) {
    return NextResponse.json(
      { message: "Transaksi tidak ditemukan atau tidak bisa diakses." },
      { status: 404 },
    );
  }

  const payload = saleMessagePayload(sale);
  const targetPhone = settings.storeWhatsApp.trim() || null;
  const messageLog = await prisma.messageLog.create({
    data: {
      type: "OWNER_TRANSACTION_REPORT",
      targetType: "OWNER",
      targetPhone,
      targetName: settings.ownerName || "Owner",
      status: "READY",
      provider: "N8N_FUTURE",
      relatedSaleId: sale.id,
      createdById: auth.session.sub,
      payload: {
        invoiceNumber: payload.invoiceNumber,
        cashierName: payload.cashierName,
        customerName: payload.customerName,
        paymentMethod: payload.paymentMethod,
        total: payload.total,
        itemCount: payload.itemCount,
        invoiceUrl: payload.invoiceUrl,
        createdAt: payload.createdAt,
      },
    },
    select: {
      id: true,
      status: true,
      type: true,
      createdAt: true,
    },
  });
  const warning = targetPhone
    ? null
    : "Nomor WhatsApp owner belum diset, log tetap dibuat.";

  return NextResponse.json({
    message: warning
      ? `Laporan transaksi owner disiapkan untuk integrasi WhatsApp. ${warning}`
      : "Laporan transaksi owner disiapkan untuk integrasi WhatsApp.",
    warning,
    data: messageLog,
  });
}
