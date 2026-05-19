export function roleLabel(role?: { name?: string | null; slug?: string | null } | null) {
  if (role?.name) {
    return role.name;
  }

  if (role?.slug) {
    if (role.slug === "developer") return "Developer";
    if (role.slug === "owner") return "Owner";
    if (role.slug === "cashier") return "Cashier";
  }

  return "";
}

export function operatorLabel(input?: {
  name?: string | null;
  role?: { name?: string | null; slug?: string | null } | null;
} | null) {
  const name = input?.name?.trim() || "Operator tidak diketahui";
  const role = roleLabel(input?.role);

  return role ? `${name} (${role})` : name;
}

export function customerLabel(input?: { name?: string | null } | null) {
  return input?.name?.trim() || "Walk-in";
}

export function transactionIdentityLabel(input: {
  operator?: {
    name?: string | null;
    role?: { name?: string | null; slug?: string | null } | null;
  } | null;
  customer?: { name?: string | null } | null;
}) {
  return `Operator ${operatorLabel(input.operator)} • Customer ${customerLabel(
    input.customer,
  )}`;
}
