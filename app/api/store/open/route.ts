import { requireOwner } from "@/lib/auth-session";
import { openStore } from "@/lib/store-status";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const auth = await requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const status = await openStore(auth.session.sub);

  revalidatePath("/dashboard");

  return NextResponse.json({ data: status });
}
