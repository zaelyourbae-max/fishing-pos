import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

type SeedUser = {
  email: string;
  name: string;
  password: string;
  roleId: number;
};

async function upsertRole(slug: string, name: string) {
  return prisma.role.upsert({
    where: {
      slug,
    },
    update: {
      name,
    },
    create: {
      slug,
      name,
    },
  });
}

async function upsertUser({ email, name, password, roleId }: SeedUser) {
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name,
      password: passwordHash,
      roleId,
      isActive: true,
      deletedAt: null,
    },
    create: {
      name,
      email,
      password: passwordHash,
      roleId,
      isActive: true,
    },
  });
}

async function main() {
  const ownerRole = await upsertRole("owner", "Owner");
  const cashierRole = await upsertRole("cashier", "Cashier");
  await upsertRole("developer", "Developer");

  await upsertUser({
    email: "owner@toko.local",
    name: "Owner Development",
    password: "owner123",
    roleId: ownerRole.id,
  });

  await upsertUser({
    email: "cashier@toko.local",
    name: "Cashier Development",
    password: "cashier123",
    roleId: cashierRole.id,
  });

  await prisma.paymentMethod.upsert({
    where: { code: "CASH" },
    update: { name: "Cash", type: "CASH", isActive: true },
    create: { code: "CASH", name: "Cash", type: "CASH", isActive: true },
  });
  await prisma.paymentMethod.upsert({
    where: { code: "TRANSFER" },
    update: { name: "Transfer Bank", type: "BANK_TRANSFER", isActive: true },
    create: {
      code: "TRANSFER",
      name: "Transfer Bank",
      type: "BANK_TRANSFER",
      isActive: true,
    },
  });
  await prisma.paymentMethod.upsert({
    where: { code: "QRIS" },
    update: { name: "QRIS", type: "QRIS", isActive: true },
    create: { code: "QRIS", name: "QRIS", type: "QRIS", isActive: true },
  });

  console.log("Development users seeded:");
  console.log("- OWNER   owner@toko.local   / owner123");
  console.log("- CASHIER cashier@toko.local / cashier123");
  console.log("Payment methods seeded: CASH, TRANSFER, QRIS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
