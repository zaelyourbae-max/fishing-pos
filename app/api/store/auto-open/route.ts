import { requireOwner } from "@/lib/auth-session";
import { isValidTime, updateAutoOpen } from "@/lib/store-status";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body.enabled);
  const time = body.time === undefined ? undefined : String(body.time).trim();

  if (time !== undefined && !isValidTime(time)) {
    return NextResponse.json(
      { message: "Format jam tidak valid. Gunakan HH:MM (24 jam)." },
      { status: 422 },
    );
  }

  const status = await updateAutoOpen({ enabled, time });

  return NextResponse.json({ data: status });
}
