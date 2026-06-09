export type RoleSlug = "developer" | "owner" | "cashier";

export function isRoleSlug(role: string | null): role is RoleSlug {
  return role === "developer" || role === "owner" || role === "cashier";
}

export function isOwnerRole(role: string | null) {
  return role === "owner" || role === "developer";
}

export function canAccessReports(role: string | null) {
  return isOwnerRole(role);
}

export function canAccessReturns(role: string | null) {
  return isOwnerRole(role);
}

export function canViewCostPrice(role: string | null) {
  return isOwnerRole(role);
}

export function canViewProfit(role: string | null) {
  return isOwnerRole(role);
}

export function canManageProducts(role: string | null) {
  return isOwnerRole(role);
}

export function canUsePOS(role: string | null) {
  return isRoleSlug(role);
}

// Modul Performa: owner melihat semua kasir, kasir melihat dirinya sendiri.
// Keduanya boleh akses; pemisahan datanya ditangani di halaman.
export function canAccessPerformance(role: string | null) {
  return isRoleSlug(role);
}

export function canAccessCustomers(role: string | null) {
  return isRoleSlug(role);
}

export function canAccessPurchases(role: string | null) {
  return isOwnerRole(role);
}

export function canAccessSettings(role: string | null) {
  return isOwnerRole(role);
}

export function canManageUsers(role: string | null) {
  return isOwnerRole(role);
}

export function canAccessSuppliers(role: string | null) {
  return isOwnerRole(role);
}

export function canAccessStockOpname(role: string | null) {
  // Stock Opname hanya untuk owner/developer. Kasir tidak punya akses.
  return isOwnerRole(role);
}

export function canManageStockOpname(role: string | null) {
  return isOwnerRole(role);
}
