import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.product.createMany({
    data: [
      {
        name: "Joran Shimano FX",
        sku: "JOR-001",
        price: 350000,
        stock: 10,
        isActive: true,
      },
      {
        name: "Reel Daiwa BG",
        sku: "REL-001",
        price: 1200000,
        stock: 5,
        isActive: true,
      },
      {
        name: "Senar PE 8X",
        sku: "SNR-001",
        price: 95000,
        stock: 20,
        isActive: true,
      },
      {
        name: "Umpan Soft Frog",
        sku: "UMP-001",
        price: 45000,
        stock: 15,
        isActive: true,
      },
    ],
  });

  console.log("Seeder produk selesai");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });