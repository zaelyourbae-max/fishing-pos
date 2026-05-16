import { requireCashier } from "@/lib/auth-session";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

type SaleItemInput = {
  product_id: number;
  quantity: number;
};

type CustomerInput = {
  id?: number;
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

function saleNumber() {
  const stamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "")
    .slice(0, 14);

  return `SL-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(req: Request) {
  const auth = requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { session } = auth;

  const body = await req.json();
  const items = (body.items ?? []) as SaleItemInput[];
  const customer = (body.customer ?? {}) as CustomerInput;
  const customerIdInput = body.customer_id ? Number(body.customer_id) : null;
  const customerPhone = normalizeIndonesianPhone(customer.phone ?? "");
  const customerName = String(customer.name ?? "").trim();
  const customerAddress = String(customer.address ?? "").trim();
  const customerNotes = String(customer.notes ?? "").trim();
  const paidAmountInput = Number(body.paid_amount ?? 0);
  const paymentMethod =
    String(body.payment_method ?? "CASH").trim().toUpperCase() || "CASH";

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      {
        message: "Cart masih kosong.",
      },
      {
        status: 422,
      },
    );
  }

  for (const [index, item] of items.entries()) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return NextResponse.json(
        {
          message: `Item ${index + 1} tidak valid.`,
        },
        {
          status: 422,
        },
      );
    }
  }

  if (!Number.isFinite(paidAmountInput) || paidAmountInput < 0) {
    return NextResponse.json(
      {
        message: "Nominal pembayaran tidak valid.",
      },
      {
        status: 422,
      },
    );
  }

  if (customerPhone && !customerName && !customerIdInput) {
    return NextResponse.json(
      {
        message: "Nama customer wajib diisi untuk customer baru.",
      },
      {
        status: 422,
      },
    );
  }

  const requiredQty = new Map<number, number>();

  for (const item of items) {
    const productId = Number(item.product_id);
    requiredQty.set(
      productId,
      (requiredQty.get(productId) ?? 0) + Number(item.quantity),
    );
  }

  try {
    const sale = await prisma.$transaction(
      async (tx) => {
        const activePaymentMethod = await tx.paymentMethod.findFirst({
          where: {
            code: paymentMethod,
            isActive: true,
          },
          select: {
            code: true,
          },
        });

        if (!activePaymentMethod) {
          throw new Error("PAYMENT_METHOD_NOT_FOUND");
        }

        let saleCustomerId = customerIdInput;

        if (customerPhone) {
          const existingCustomer = await tx.customer.findUnique({
            where: {
              phone: customerPhone,
            },
            select: {
              id: true,
              isActive: true,
              deletedAt: true,
            },
          });

          if (existingCustomer) {
            if (!existingCustomer.isActive || existingCustomer.deletedAt) {
              throw new Error("CUSTOMER_NOT_FOUND");
            }

            saleCustomerId = existingCustomer.id;
          } else {
            const createdCustomer = await tx.customer.create({
              data: {
                customerCode: `CUST-${customerPhone}`,
                name: customerName,
                phone: customerPhone,
                address: customerAddress || null,
                notes: customerNotes || null,
                isActive: true,
              },
              select: {
                id: true,
              },
            });

            saleCustomerId = createdCustomer.id;
          }
        } else if (saleCustomerId) {
          const customerRecord = await tx.customer.findFirst({
            where: {
              id: saleCustomerId,
              isActive: true,
              deletedAt: null,
            },
            select: {
              id: true,
            },
          });

          if (!customerRecord) {
            throw new Error("CUSTOMER_NOT_FOUND");
          }
        }

        const productIds = [...requiredQty.keys()];
        const products = await tx.product.findMany({
          where: {
            id: {
              in: productIds,
            },
            isActive: true,
          },
        });
        const productMap = new Map(
          products.map((product) => [product.id, product]),
        );

        for (const [productId, qty] of requiredQty) {
          const product = productMap.get(productId);

          if (!product) {
            throw new Error("PRODUCT_NOT_FOUND");
          }

          if (product.stock < qty) {
            throw new Error(
              `INSUFFICIENT_STOCK:${product.name}:${product.stock}:${qty}`,
            );
          }
        }

        const preparedItems = items.map((item) => {
          const product = productMap.get(Number(item.product_id));
          const quantity = Number(item.quantity);
          const unitPrice = Number(product?.price ?? 0);

          return {
            productId: Number(item.product_id),
            productSku: product?.sku,
            productName: product?.name,
            quantity,
            unitPrice,
            subtotal: quantity * unitPrice,
          };
        });
        const subtotal = preparedItems.reduce(
          (total, item) => total + item.subtotal,
          0,
        );
        const totalQty = preparedItems.reduce(
          (total, item) => total + item.quantity,
          0,
        );
        const paidAmount =
          body.paid_amount === undefined ||
          body.paid_amount === null ||
          body.paid_amount === ""
            ? subtotal
            : paidAmountInput;
        const invoiceNumber = saleNumber();

        const createdSale = await tx.sale.create({
          data: {
            invoiceNumber,
            subtotal,
            paidAmount,
            paymentMethod,
            cashierId: session.sub,
            customerId: saleCustomerId,
          },
        });

        const runningStock = new Map(
          products.map((product) => [product.id, product.stock]),
        );
        const responseItems = [];

        for (const [productId, qty] of requiredQty) {
          const update = await tx.product.updateMany({
            where: {
              id: productId,
              isActive: true,
              stock: {
                gte: qty,
              },
            },
            data: {
              stock: {
                decrement: qty,
              },
            },
          });

          if (update.count !== 1) {
            throw new Error("STOCK_CHANGED");
          }
        }

        for (const item of preparedItems) {
          const stockBefore = runningStock.get(item.productId) ?? 0;
          const stockAfter = stockBefore - item.quantity;
          runningStock.set(item.productId, stockAfter);

          const saleItem = await tx.saleItem.create({
            data: {
              saleId: createdSale.id,
              productId: item.productId,
              qty: item.quantity,
              price: item.unitPrice,
              subtotal: item.subtotal,
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              saleId: createdSale.id,
              saleItemId: saleItem.id,
              createdById: session.sub,
              type: "sale",
              qty: -item.quantity,
              stockBefore,
              stockAfter,
              reference: invoiceNumber,
              notes: "Penjualan POS",
            },
          });

          responseItems.push({
            id: saleItem.id,
            product_id: item.productId,
            product_sku: item.productSku,
            product_name: item.productName,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            line_total: item.subtotal,
          });
        }

        return {
          id: createdSale.id,
          sale_number: createdSale.invoiceNumber,
          status: "completed",
          payment_status: paidAmount >= subtotal ? "paid" : "partial",
          payment_method: createdSale.paymentMethod,
          subtotal,
          discount_amount: 0,
          tax_amount: 0,
          grand_total: subtotal,
          paid_amount: paidAmount,
          change_amount: Math.max(paidAmount - subtotal, 0),
          total_qty: totalQty,
          items: responseItems,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return NextResponse.json(
      {
        data: sale,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transaksi gagal.";

    if (message === "CUSTOMER_NOT_FOUND") {
      return NextResponse.json(
        {
          message: "Customer tidak aktif atau tidak ditemukan.",
        },
        {
          status: 422,
        },
      );
    }

    if (message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json(
        {
          message: "Produk tidak aktif atau tidak ditemukan.",
        },
        {
          status: 422,
        },
      );
    }

    if (message.startsWith("INSUFFICIENT_STOCK:")) {
      const [, name, available, requested] = message.split(":");

      return NextResponse.json(
        {
          message: `Stok ${name} tidak cukup. Tersedia ${available}, diminta ${requested}.`,
        },
        {
          status: 422,
        },
      );
    }

    if (message === "STOCK_CHANGED") {
      return NextResponse.json(
        {
          message: "Stok berubah saat transaksi diproses. Coba ulangi transaksi.",
        },
        {
          status: 409,
        },
      );
    }

    if (message === "PAYMENT_METHOD_NOT_FOUND") {
      return NextResponse.json(
        {
          message: "Metode pembayaran tidak aktif atau tidak ditemukan.",
        },
        {
          status: 422,
        },
      );
    }

    console.error(error);

    return NextResponse.json(
      {
        message: "Transaksi gagal.",
      },
      {
        status: 500,
      },
    );
  }
}
