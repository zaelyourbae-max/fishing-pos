import { requireOwner } from "@/lib/auth-session";
import { getLoyaltyConfig, updateLoyaltyConfig } from "@/lib/loyalty-settings";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({ data: await getLoyaltyConfig() });
}

export async function PATCH(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json().catch(() => ({}));
  const interval =
    body.interval === undefined ? undefined : Number(body.interval);
  const minPurchase =
    body.minPurchase === undefined ? undefined : Number(body.minPurchase);

  if (interval !== undefined && (!Number.isFinite(interval) || interval < 1)) {
    return NextResponse.json(
      { message: "Interval transaksi minimal 1." },
      { status: 422 },
    );
  }

  if (
    minPurchase !== undefined &&
    (!Number.isFinite(minPurchase) || minPurchase < 0)
  ) {
    return NextResponse.json(
      { message: "Minimal pembelian tidak valid." },
      { status: 422 },
    );
  }

  const config = await updateLoyaltyConfig({ interval, minPurchase });

  return NextResponse.json({ data: config });
}
