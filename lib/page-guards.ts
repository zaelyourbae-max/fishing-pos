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
import { isStoreOpen } from "@/lib/store-status";

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

/** Tujuan redirect saat toko TUTUP, tergantung role. */
function closedRedirectTarget(role: RoleSlug) {
  // Owner masih bisa melihat dashboard/laporan/dll & membuka toko lagi.
  // Kasir hanya boleh di layar kasir (palet warna tetap tersedia di chrome).
  return isOwnerRole(role) ? "/dashboard" : "/cashier";
}

/**
 * Guard halaman OPERASIONAL (POS, penjualan, pembelian, retur, produk,
 * stock opname). Saat toko TUTUP, semua role dikunci dan diarahkan keluar.
 */
export async function requireStoreOpenPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!(await isStoreOpen())) {
    redirect(closedRedirectTarget(session.role));
  }

  return session;
}

/**
 * Saat toko TUTUP, kasir hanya boleh berada di layar kasir. Halaman non-
 * operasional yang masih bisa diakses kasir (mis. Customer) memanggil ini
 * agar kasir tetap diarahkan keluar saat tutup, sementara owner tetap bisa.
 */
export async function enforceCashierClosedLock(session: ProtectedSession) {
  if (isOwnerRole(session.role)) {
    return;
  }

  if (!(await isStoreOpen())) {
    redirect("/cashier");
  }
}

export async function requireOwnerPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!isOwnerRole(session.role)) {
    redirect("/cashier");
  }

  return session;
}

/** Owner-only DAN operasional (mis. Pembelian, Supplier, Retur Supplier). */
export async function requireOwnerStoreOpenPage(): Promise<ProtectedSession> {
  const session = await requireOwnerPage();

  if (!(await isStoreOpen())) {
    redirect("/dashboard");
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

  if (!(await isStoreOpen())) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireCustomersPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!canAccessCustomers(session.role)) {
    redirect("/cashier");
  }

  // Customer boleh diakses owner saat tutup; kasir tetap dikunci ke layar kasir.
  await enforceCashierClosedLock(session);

  return session;
}

export async function requireManageProductsPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (!canManageProducts(session.role)) {
    redirect("/products");
  }

  if (!(await isStoreOpen())) {
    redirect("/dashboard");
  }

  return session;
}

export async function requirePosPage(): Promise<ProtectedSession> {
  return requireStoreOpenPage();
}

export async function requireCashierPage(): Promise<ProtectedSession> {
  const session = await requireProtectedPage();

  if (session.role !== "cashier") {
    redirect("/dashboard");
  }

  return session;
}
