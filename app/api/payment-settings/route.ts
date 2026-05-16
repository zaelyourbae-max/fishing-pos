import { requireCashier, requireOwner } from "@/lib/auth-session";
import { getPaymentSettings, updatePaymentSettings } from "@/lib/payments";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    data: await getPaymentSettings(),
  });
}

export async function PATCH(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  const settings = await updatePaymentSettings({
    bankName:
      body.bankName === undefined
        ? undefined
        : String(body.bankName ?? "").trim(),
    bankAccountNumber:
      body.bankAccountNumber === undefined
        ? undefined
        : String(body.bankAccountNumber ?? "").trim(),
    bankAccountOwner:
      body.bankAccountOwner === undefined
        ? undefined
        : String(body.bankAccountOwner ?? "").trim(),
    qrisImageUrl:
      body.qrisImageUrl === undefined
        ? undefined
        : String(body.qrisImageUrl ?? "").trim(),
  });

  return NextResponse.json({
    data: settings,
  });
}
