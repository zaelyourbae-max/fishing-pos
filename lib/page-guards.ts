import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/server-session";
import type { TokenPayload } from "@/lib/auth-session";

type ProtectedSession = TokenPayload & {
  role: "owner" | "cashier" | "developer";
};

export async function requireProtectedPage(): Promise<ProtectedSession> {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (
    session.role !== "owner" &&
    session.role !== "cashier" &&
    session.role !== "developer"
  ) {
    redirect("/login");
  }

  return session as ProtectedSession;
}

export async function requireOwnerPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (session.role !== "owner" && session.role !== "developer") {
    redirect("/cashier");
  }

  return session;
}

export async function requirePosPage(): Promise<ProtectedSession> {
  return requireProtectedPage();
}

export async function requireCashierPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (session.role !== "cashier") {
    redirect("/dashboard");
  }

  return session;
}
