import { requireCashier, requireOwner } from "@/lib/auth-session";
import {
  clearQrisImage,
  getPaymentSettings,
  updatePaymentSettings,
} from "@/lib/payments";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    data: await getPaymentSettings(),
  });
}

export async function PATCH(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  let settings = await updatePaymentSettings({
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

  if (
    body.qrisImageUrl !== undefined &&
    String(body.qrisImageUrl ?? "").trim() === ""
  ) {
    settings = await clearQrisImage();
  }

  return NextResponse.json({
    data: settings,
  });
}
