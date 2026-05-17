import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/server-session";
import {
  canAccessReports,
  canAccessReturns,
  canAccessCustomers,
  canManageProducts,
  canUsePOS,
  isOwnerRole,
  type RoleSlug,
  type TokenPayload,
} from "@/lib/auth-session";

type ProtectedSession = TokenPayload & {
  role: RoleSlug;
};

export async function requireProtectedPage(): Promise<ProtectedSession> {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (!canUsePOS(session.role)) {
    redirect("/login");
  }

  return session as ProtectedSession;
}

export async function requireOwnerPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!isOwnerRole(session.role)) {
    redirect("/cashier");
  }

  return session;
}

export async function requireReportsPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!canAccessReports(session.role)) {
    redirect("/cashier");
  }

  return session;
}

export async function requireReturnsPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!canAccessReturns(session.role)) {
    redirect("/cashier");
  }

  return session;
}

export async function requireCustomersPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!canAccessCustomers(session.role)) {
    redirect("/cashier");
  }

  return session;
}

export async function requireManageProductsPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!canManageProducts(session.role)) {
    redirect("/products");
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
