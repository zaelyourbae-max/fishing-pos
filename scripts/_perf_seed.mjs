import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SEED_PREFIX = "PERF-SEED-";

// Bersihkan dulu data seed lama agar idempoten.
const oldItems = await prisma.saleItem.deleteMany({
  where: { sale: { invoiceNumber: { startsWith: SEED_PREFIX } } },
});
const oldSales = await prisma.sale.deleteMany({
  where: { invoiceNumber: { startsWith: SEED_PREFIX } },
});
console.log(`Cleanup: hapus ${oldSales.count} sale + ${oldItems.count} item seed lama.`);

const products = await prisma.product.findMany({
  where: { isActive: true },
  select: { id: true, price: true, costPrice: true },
});

function ri(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[ri(0, arr.length - 1)];
}

const NOW = new Date(2026, 5, 9, 14, 0, 0); // 9 Jun 2026
function dateThisMonth() {
  return new Date(2026, 5, ri(1, 9), ri(8, 20), ri(0, 59));
}
function dateLastMonth() {
  return new Date(2026, 4, ri(1, 28), ri(8, 20), ri(0, 59));
}

let invSeq = 0;
function nextInvoice() {
  invSeq += 1;
  return `${SEED_PREFIX}${String(invSeq).padStart(5, "0")}`;
}

async function makeSale(cashierId, createdAt, { cancelled = false, big = false } = {}) {
  const lineCount = big ? ri(2, 5) : ri(1, 3);
  const chosen = Array.from({ length: lineCount }, () => pick(products));
  const items = chosen.map((p) => {
    const qty = big ? ri(1, 4) : ri(1, 2);
    return {
      productId: p.id,
      qty,
      price: p.price,
      unitCost: p.costPrice ?? 0,
      subtotal: p.price * qty,
      originalPrice: p.price,
    };
  });
  const subtotal = items.reduce((s, it) => s + it.subtotal, 0);

  await prisma.sale.create({
    data: {
      invoiceNumber: nextInvoice(),
      subtotal,
      paidAmount: cancelled ? 0 : subtotal,
      subtotalBeforeLoyalty: subtotal,
      paymentMethod: "CASH",
      transactionStatus: cancelled ? "CANCELLED" : "SUCCESS",
      paymentStatus: cancelled ? "FAILED" : "PAID",
      cancelReason: cancelled ? "Demo: dibatalkan kasir" : null,
      cancelledAt: cancelled ? createdAt : null,
      createdAt,
      cashierId,
      items: { create: items },
    },
  });
}

// Profil: [cashierId, thisMonthOK, lastMonthOK, thisMonthCancel, big?]
const plan = [
  { id: 8, name: "beatrix", thisOK: 26, lastOK: 18, cancel: 1, big: true },   // top, naik
  { id: 6, name: "ica", thisOK: 13, lastOK: 16, cancel: 3, big: false },      // mid, turun, byk batal
  { id: 1, name: "Cashier Demo", thisOK: 8, lastOK: 5, cancel: 0, big: false },// kecil, naik
];

for (const p of plan) {
  for (let i = 0; i < p.thisOK; i++) await makeSale(p.id, dateThisMonth(), { big: p.big });
  for (let i = 0; i < p.lastOK; i++) await makeSale(p.id, dateLastMonth(), { big: p.big });
  for (let i = 0; i < p.cancel; i++) await makeSale(p.id, dateThisMonth(), { cancelled: true });
  console.log(`Seed ${p.name}: ${p.thisOK} bln ini + ${p.lastOK} bln lalu + ${p.cancel} batal`);
}

const total = await prisma.sale.count({ where: { invoiceNumber: { startsWith: SEED_PREFIX } } });
console.log(`TOTAL sale seed sekarang: ${total}`);
await prisma.$disconnect();
