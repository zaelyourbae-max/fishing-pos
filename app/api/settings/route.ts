import { requireOwner } from "@/lib/auth-session";
import { getSettings, updateSettings } from "@/lib/settings";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json({
    data: await getSettings(),
  });
}

export async function PATCH(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json();
  const settings = await updateSettings({
    storeName:
      body.storeName === undefined
        ? undefined
        : String(body.storeName ?? "").trim(),
    storeWhatsApp:
      body.storeWhatsApp === undefined
        ? undefined
        : String(body.storeWhatsApp ?? "").trim(),
    storeAddress:
      body.storeAddress === undefined
        ? undefined
        : String(body.storeAddress ?? "").trim(),
  });

  return NextResponse.json({
    data: settings,
  });
}
