import { requireCashier, requireOwner } from "@/lib/auth-session";
import {
  DEFAULT_PAYMENT_METHODS,
  getActivePaymentMethods,
  getAllPaymentMethods,
} from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const ALLOWED_TYPES = ["CASH", "BANK_TRANSFER", "QRIS"];

export async function GET(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  if (includeInactive && auth.session.role === "cashier") {
    return NextResponse.json({ message: "Forbidden." }, { status: 403 });
  }

  const methods = includeInactive
    ? await getAllPaymentMethods()
    : await getActivePaymentMethods();

  return NextResponse.json({
    data: methods,
  });
}

export async function POST(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  const code = String(body.code ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim();
  const type = String(body.type ?? "").trim().toUpperCase();

  if (!code || !name || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.json(
      { message: "Code, nama, dan tipe payment wajib valid." },
      { status: 422 },
    );
  }

  const method = await prisma.paymentMethod.create({
    data: {
      code,
      name,
      type,
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/pos");

  return NextResponse.json({ data: method }, { status: 201 });
}

export async function PATCH(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  const code = String(body.code ?? "").trim().toUpperCase();

  if (!code) {
    return NextResponse.json(
      { message: "Code payment method wajib diisi." },
      { status: 422 },
    );
  }

  const defaultCodes = new Set<string>(
    DEFAULT_PAYMENT_METHODS.map((item) => item.code),
  );
  const method = await prisma.paymentMethod.update({
    where: {
      code,
    },
    data: {
      ...(body.name !== undefined && !defaultCodes.has(code)
        ? { name: String(body.name ?? "").trim() }
        : {}),
      ...(body.type !== undefined && !defaultCodes.has(code)
        ? { type: String(body.type ?? "").trim().toUpperCase() }
        : {}),
      ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/pos");

  return NextResponse.json({ data: method });
}
