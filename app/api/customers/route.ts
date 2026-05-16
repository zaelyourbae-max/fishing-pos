import { requireCashier } from "@/lib/auth-session";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const phone = normalizeIndonesianPhone(searchParams.get("phone") ?? "");

  if (!phone) {
    return NextResponse.json({
      data: null,
      normalized_phone: "",
      found: false,
    });
  }

  const customer = await prisma.customer.findFirst({
    where: {
      phone,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      customerCode: true,
      name: true,
      phone: true,
      address: true,
      notes: true,
    },
  });

  return NextResponse.json({
    data: customer,
    normalized_phone: phone,
    found: Boolean(customer),
  });
}
