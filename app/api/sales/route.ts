import { requireCashier } from "@/lib/auth-session";
import {
  closingDateFromInput,
  dateInputValue,
  isClosingLockedForDate,
} from "@/lib/daily-closing";
import {
  calculateLoyaltyDiscount,
  LOYALTY_MIN_PURCHASE_AMOUNT,
  loyaltyProgressFromValidCount,
  meetsLoyaltyMinimumPurchase,
  normalizeLoyaltyBenefitType,
} from "@/lib/loyalty";
import { normalizeIndonesianPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { FINAL_SALE_STATUS_WHERE, resolveSaleStatuses } from "@/lib/sale-status";
import { PaymentStatus, Prisma, SaleItemDiscountType, TransactionStatus } from "@prisma/client";
import { NextResponse } from "next/server";

const PENDING_PAYMENT_EXPIRE_MINUTES = 15;

type SaleItemInput = {
  product_id: number;
  quantity: number;
  discount_type?: string;
  discount_value?: number | string;
  discount_reason?: string;
};

type CustomerInput = {
  id?: number;
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
};

type LoyaltyInput = {
  benefit_type?: string;
  benefit_value?: number | string;
  benefit_note?: string;
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

function pendingPaymentExpiredAt(createdAt = new Date()) {
  const expiredAt = new Date(createdAt);
  expiredAt.setMinutes(expiredAt.getMinutes() + PENDING_PAYMENT_EXPIRE_MINUTES);

  return expiredAt;
}

function shouldExpirePendingPayment(statuses: {
  transactionStatus: TransactionStatus;
  paymentStatus: PaymentStatus;
}) {
  return (
    statuses.transactionStatus === TransactionStatus.PENDING &&
    (statuses.paymentStatus === PaymentStatus.WAITING_PROOF ||
      statuses.paymentStatus === PaymentStatus.UNPAID)
  );
}

function isMissingExpiredAtMigration(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");

  return (
    message.includes("expired_at") &&
    (message.includes("does not exist") ||
      message.includes("column") ||
      message.includes("Unknown argument"))
  );
}

function normalizeDiscountType(value: unknown) {
  const type = String(value ?? "NONE").trim().toUpperCase();

  if (type === "NONE" || type === "FIXED" || type === "PERCENT") {
    return type as SaleItemDiscountType;
  }

  return null;
}

function customerCodeFromName(name: string) {
  const slug =
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 18) || "CUSTOMER";
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `CUST-${slug}-${stamp}${suffix}`;
}

function customerUpdateData(input: {
  current: {
    name: string;
    address: string | null;
    notes: string | null;
  };
  customerName: string;
  customerAddress: string;
  customerNotes: string;
}) {
  const updateData: Prisma.CustomerUpdateInput = {};

  if (input.customerName && input.customerName !== input.current.name) {
    updateData.name = input.customerName;
  }

  if (
    input.customerAddress &&
    input.customerAddress !== (input.current.address ?? "")
  ) {
    updateData.address = input.customerAddress;
  }

  if (input.customerNotes && input.customerNotes !== (input.current.notes ?? "")) {
    updateData.notes = input.customerNotes;
  }

  return updateData;
}

async function resolveSaleCustomer(input: {
  tx: Prisma.TransactionClient;
  customerIdInput: number | null;
  customerPhone: string;
  customerName: string;
  customerAddress: string;
  customerNotes: string;
}) {
  const {
    tx,
    customerIdInput,
    customerPhone,
    customerName,
    customerAddress,
    customerNotes,
  } = input;

  if (customerIdInput) {
    const customerRecord = await tx.customer.findFirst({
      where: {
        id: customerIdInput,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        address: true,
        notes: true,
      },
    });

    if (!customerRecord) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    const updateData = customerUpdateData({
      current: customerRecord,
      customerName,
      customerAddress,
      customerNotes,
    });

    if (Object.keys(updateData).length > 0) {
      await tx.customer.update({
        where: {
          id: customerRecord.id,
        },
        data: updateData,
        select: {
          id: true,
        },
      });
    }

    return customerRecord.id;
  }

  if (customerPhone) {
    const existingCustomer = await tx.customer.findUnique({
      where: {
        phone: customerPhone,
      },
      select: {
        id: true,
        name: true,
        address: true,
        notes: true,
        isActive: true,
        deletedAt: true,
      },
    });

    if (existingCustomer) {
      if (!existingCustomer.isActive || existingCustomer.deletedAt) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      const updateData = customerUpdateData({
        current: existingCustomer,
        customerName,
        customerAddress,
        customerNotes,
      });

      if (Object.keys(updateData).length > 0) {
        await tx.customer.update({
          where: {
            id: existingCustomer.id,
          },
          data: updateData,
          select: {
            id: true,
          },
        });
      }

      return existingCustomer.id;
    }

    const createdCustomer = await tx.customer.create({
      data: {
        customerCode: `CUST-${customerPhone}`,
        name: customerName || customerPhone,
        phone: customerPhone,
        address: customerAddress || null,
        notes: customerNotes || null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    return createdCustomer.id;
  }

  if (!customerName) {
    return null;
  }

  const nameOnlyCustomer = await tx.customer.create({
    data: {
      customerCode: customerCodeFromName(customerName),
      name: customerName,
      phone: null,
      address: customerAddress || null,
      notes: customerNotes || null,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  return nameOnlyCustomer.id;
}

function calculateDiscount(input: {
  type: SaleItemDiscountType;
  value: number;
  subtotalBeforeDiscount: number;
}) {
  if (input.type === SaleItemDiscountType.NONE) {
    return 0;
  }

  if (input.value < 0) {
    throw new Error("INVALID_DISCOUNT_NEGATIVE");
  }

  if (input.type === SaleItemDiscountType.PERCENT) {
    if (input.value > 100) {
      throw new Error("INVALID_DISCOUNT_PERCENT");
    }

    return Math.round((input.subtotalBeforeDiscount * input.value) / 100);
  }

  if (input.value > input.subtotalBeforeDiscount) {
    throw new Error("INVALID_DISCOUNT_FIXED");
  }

  return Math.round(input.value);
}

function saleAccessWhere(role: string | null, userId: number) {
  return role === "cashier" ? { cashierId: userId } : {};
}

export async function GET(req: Request) {
  const auth = await requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);

  if (searchParams.get("pending_qris") !== "active") {
    return NextResponse.json(
      {
        message: "Query tidak didukung.",
      },
      {
        status: 400,
      },
    );
  }

  const sale = await prisma.sale.findFirst({
    where: {
      ...saleAccessWhere(auth.session.role, auth.session.sub),
      transactionStatus: "PENDING",
      paymentStatus: "WAITING_PROOF",
      OR: [
        {
          paymentMethod: {
            contains: "QRIS",
            mode: "insensitive",
          },
        },
        {
          paymentMethod: {
            contains: "TRANSFER",
            mode: "insensitive",
          },
        },
        {
          paymentMethod: {
            contains: "BANK",
            mode: "insensitive",
          },
        },
      ],
      AND: [
        {
          OR: [
            {
              expiredAt: null,
            },
            {
              expiredAt: {
                gt: new Date(),
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      invoiceNumber: true,
      subtotal: true,
      paymentMethod: true,
      transactionStatus: true,
      paymentStatus: true,
      paymentProofUrl: true,
      expiredAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: sale
      ? {
          id: sale.id,
          sale_number: sale.invoiceNumber,
          invoice_number: sale.invoiceNumber,
          grand_total: sale.subtotal,
          payment_method: sale.paymentMethod,
          transaction_status: sale.transactionStatus,
          payment_status: sale.paymentStatus,
          payment_proof_url: sale.paymentProofUrl,
          expired_at: sale.expiredAt,
          created_at: sale.createdAt,
        }
      : null,
  });
}

export async function POST(req: Request) {
  const auth = await requireCashier(req);

  if (!auth.ok) {
    return auth.response;
  }

  const { session } = auth;

  const body = await req.json();
  const items = (body.items ?? []) as SaleItemInput[];
  const customer = (body.customer ?? {}) as CustomerInput;
  const loyalty = (body.loyalty ?? {}) as LoyaltyInput;
  const customerIdInput = body.customer_id ? Number(body.customer_id) : null;
  const customerPhone = normalizeIndonesianPhone(customer.phone ?? "");
  const customerName = String(customer.name ?? "").trim();
  const customerAddress = String(customer.address ?? "").trim();
  const customerNotes = String(customer.notes ?? "").trim();
  const paidAmountInput = Number(body.paid_amount ?? 0);
  const paymentMethod =
    String(body.payment_method ?? "CASH").trim().toUpperCase() || "CASH";
  const loyaltyBenefitType = normalizeLoyaltyBenefitType(
    loyalty.benefit_type ?? body.loyalty_benefit_type,
  );
  const loyaltyBenefitValue = Number(
    loyalty.benefit_value ?? body.loyalty_benefit_value ?? 0,
  );
  const loyaltyBenefitNote = String(
    loyalty.benefit_note ?? body.loyalty_benefit_note ?? "",
  ).trim();

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
    const discountType = normalizeDiscountType(item.discount_type);
    const discountValue = Number(item.discount_value ?? 0);

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !discountType ||
      !Number.isFinite(discountValue)
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

  if (!loyaltyBenefitType || !Number.isFinite(loyaltyBenefitValue)) {
    return NextResponse.json(
      {
        message: "Benefit loyalty tidak valid.",
      },
      {
        status: 422,
      },
    );
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

        const checkoutDate = closingDateFromInput(dateInputValue(new Date()));

        if (
          checkoutDate &&
          (await isClosingLockedForDate(tx, checkoutDate))
        ) {
          throw new Error("DAILY_CLOSING_LOCKED");
        }

        const saleCustomerId = await resolveSaleCustomer({
          tx,
          customerIdInput,
          customerPhone,
          customerName,
          customerAddress,
          customerNotes,
        });

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
          const unitCost = Number(product?.costPrice ?? 0);
          const discountType =
            normalizeDiscountType(item.discount_type) ?? SaleItemDiscountType.NONE;
          const discountValue =
            discountType === SaleItemDiscountType.NONE
              ? 0
              : Number(item.discount_value ?? 0);
          const rawDiscountReason = String(item.discount_reason ?? "").trim();
          const subtotalBeforeDiscount = quantity * unitPrice;
          const discountAmount = calculateDiscount({
            type: discountType,
            value: discountValue,
            subtotalBeforeDiscount,
          });
          const subtotalAfterDiscount = Math.max(
            subtotalBeforeDiscount - discountAmount,
            0,
          );
          const discountReason =
            discountAmount > 0 ? rawDiscountReason : null;

          if (discountAmount > 0 && !discountReason) {
            throw new Error("INVALID_DISCOUNT_REASON");
          }

          return {
            productId: Number(item.product_id),
            productSku: product?.sku,
            productName: product?.name,
            quantity,
            unitPrice,
            unitCost,
            discountType,
            discountValue,
            discountAmount,
            discountReason,
            subtotalBeforeDiscount,
            subtotalAfterDiscount,
            subtotal: subtotalAfterDiscount,
          };
        });
        const subtotalBeforeLoyalty = preparedItems.reduce(
          (total, item) => total + item.subtotal,
          0,
        );
        const totalQty = preparedItems.reduce(
          (total, item) => total + item.quantity,
          0,
        );
        const loyaltySnapshot = {
          applied: false,
          milestone: null as number | null,
          benefitType: "NONE",
          benefitValue: 0,
          discountAmount: 0,
          note: null as string | null,
        };

        if (!saleCustomerId) {
          if (loyaltyBenefitType !== "NONE" || loyaltyBenefitValue > 0) {
            throw new Error("LOYALTY_CUSTOMER_REQUIRED");
          }
        } else {
          const validTransactions = await tx.sale.count({
            where: {
              customerId: saleCustomerId,
              ...FINAL_SALE_STATUS_WHERE,
            },
          });
          const progress = loyaltyProgressFromValidCount(validTransactions);
          const eligibleMilestone = progress.eligibleMilestone;

          if (!eligibleMilestone) {
            if (loyaltyBenefitType !== "NONE" || loyaltyBenefitValue > 0) {
              throw new Error("LOYALTY_NOT_ELIGIBLE");
            }
          } else {
            const reservedMilestone = await tx.sale.findFirst({
              where: {
                customerId: saleCustomerId,
                transactionStatus: "PENDING",
                paymentStatus: "WAITING_PROOF",
                loyaltyApplied: true,
                loyaltyMilestone: eligibleMilestone,
              },
              select: {
                id: true,
              },
            });

            if (reservedMilestone) {
              throw new Error("LOYALTY_MILESTONE_RESERVED");
            } else {
              if (!loyaltyBenefitNote) {
                throw new Error("LOYALTY_NOTE_REQUIRED");
              }

              if (!meetsLoyaltyMinimumPurchase(subtotalBeforeLoyalty)) {
                if (
                  loyaltyBenefitType === "FIXED" ||
                  loyaltyBenefitType === "PERCENT" ||
                  loyaltyBenefitValue > 0
                ) {
                  throw new Error("LOYALTY_MIN_PURCHASE_NOT_MET");
                }

                loyaltySnapshot.applied = true;
                loyaltySnapshot.milestone = eligibleMilestone;
                loyaltySnapshot.benefitType = "NONE";
                loyaltySnapshot.benefitValue = 0;
                loyaltySnapshot.note = loyaltyBenefitNote;
                loyaltySnapshot.discountAmount = 0;
              } else {
                if (
                  (loyaltyBenefitType === "FIXED" ||
                    loyaltyBenefitType === "PERCENT") &&
                  loyaltyBenefitValue <= 0
                ) {
                  throw new Error("LOYALTY_VALUE_REQUIRED");
                }

                if (loyaltyBenefitValue < 0) {
                  throw new Error("LOYALTY_VALUE_INVALID");
                }

                if (loyaltyBenefitType === "PERCENT" && loyaltyBenefitValue > 100) {
                  throw new Error("LOYALTY_PERCENT_INVALID");
                }

                if (
                  loyaltyBenefitType === "FIXED" &&
                  loyaltyBenefitValue > subtotalBeforeLoyalty
                ) {
                  throw new Error("LOYALTY_FIXED_TOO_HIGH");
                }

                loyaltySnapshot.applied = true;
                loyaltySnapshot.milestone = eligibleMilestone;
                loyaltySnapshot.benefitType = loyaltyBenefitType;
                loyaltySnapshot.benefitValue =
                  loyaltyBenefitType === "NONE"
                    ? 0
                    : Math.round(loyaltyBenefitValue);
                loyaltySnapshot.note = loyaltyBenefitNote;
                loyaltySnapshot.discountAmount = calculateLoyaltyDiscount({
                  type: loyaltyBenefitType,
                  value: loyaltyBenefitValue,
                  subtotalBeforeLoyalty,
                });
              }
            }
          }
        }

        const subtotal = Math.max(
          subtotalBeforeLoyalty - loyaltySnapshot.discountAmount,
          0,
        );
        const paidAmount =
          body.paid_amount === undefined ||
          body.paid_amount === null ||
          body.paid_amount === ""
            ? subtotal
            : paidAmountInput;
        const invoiceNumber = saleNumber();
        const saleStatuses = resolveSaleStatuses(paymentMethod);
        const createdAt = new Date();
        const expiredAt = shouldExpirePendingPayment(saleStatuses)
          ? pendingPaymentExpiredAt(createdAt)
          : null;

        const createdSale = await tx.sale.create({
          data: {
            invoiceNumber,
            subtotal,
            paidAmount,
            subtotalBeforeLoyalty,
            loyaltyApplied: loyaltySnapshot.applied,
            loyaltyMilestone: loyaltySnapshot.milestone,
            loyaltyBenefitType: loyaltySnapshot.benefitType,
            loyaltyBenefitValue: loyaltySnapshot.benefitValue,
            loyaltyDiscountAmount: loyaltySnapshot.discountAmount,
            loyaltyBenefitNote: loyaltySnapshot.note,
            paymentMethod,
            transactionStatus: saleStatuses.transactionStatus,
            paymentStatus: saleStatuses.paymentStatus,
            expiredAt,
            createdAt,
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
              unitCost: item.unitCost,
              originalPrice: new Prisma.Decimal(item.unitPrice),
              discountType: item.discountType,
              discountValue: new Prisma.Decimal(item.discountValue),
              discountAmount: new Prisma.Decimal(item.discountAmount),
              discountReason: item.discountReason,
              subtotalBeforeDiscount: new Prisma.Decimal(
                item.subtotalBeforeDiscount,
              ),
              subtotalAfterDiscount: new Prisma.Decimal(
                item.subtotalAfterDiscount,
              ),
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
            original_price: item.unitPrice,
            discount_type: item.discountType,
            discount_value: item.discountValue,
            discount_amount: item.discountAmount,
            discount_reason: item.discountReason,
            subtotal_before_discount: item.subtotalBeforeDiscount,
            subtotal_after_discount: item.subtotalAfterDiscount,
            line_total: item.subtotal,
          });
        }

        return {
          id: createdSale.id,
          sale_number: createdSale.invoiceNumber,
          status: createdSale.transactionStatus,
          transaction_status: createdSale.transactionStatus,
          payment_status: createdSale.paymentStatus,
          payment_proof_url: createdSale.paymentProofUrl,
          expired_at: createdSale.expiredAt,
          payment_method: createdSale.paymentMethod,
          subtotal: subtotalBeforeLoyalty,
          subtotal_before_loyalty: subtotalBeforeLoyalty,
          discount_amount: preparedItems.reduce(
            (total, item) => total + item.discountAmount,
            0,
          ),
          total_item_discount_amount: preparedItems.reduce(
            (total, item) => total + item.discountAmount,
            0,
          ),
          loyalty_applied: loyaltySnapshot.applied,
          loyalty_milestone: loyaltySnapshot.milestone,
          loyalty_benefit_type: loyaltySnapshot.benefitType,
          loyalty_benefit_value: loyaltySnapshot.benefitValue,
          loyalty_discount_amount: loyaltySnapshot.discountAmount,
          loyalty_benefit_note: loyaltySnapshot.note,
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

    if (message === "DAILY_CLOSING_LOCKED") {
      return NextResponse.json(
        {
          message:
            "Transaksi tidak bisa dibuat karena toko sudah closing. Silakan reopen closing terlebih dahulu.",
        },
        {
          status: 423,
        },
      );
    }

    if (message === "INVALID_DISCOUNT_NEGATIVE") {
      return NextResponse.json(
        {
          message: "Diskon item tidak boleh negatif.",
        },
        {
          status: 422,
        },
      );
    }

    if (message === "INVALID_DISCOUNT_PERCENT") {
      return NextResponse.json(
        {
          message: "Diskon persen harus berada di antara 0 dan 100.",
        },
        {
          status: 422,
        },
      );
    }

    if (message === "INVALID_DISCOUNT_FIXED") {
      return NextResponse.json(
        {
          message: "Diskon nominal tidak boleh melebihi subtotal item.",
        },
        {
          status: 422,
        },
      );
    }

    if (message === "INVALID_DISCOUNT_REASON") {
      return NextResponse.json(
        {
          message: "Alasan diskon wajib diisi jika diskon lebih dari 0.",
        },
        {
          status: 422,
        },
      );
    }

    const loyaltyErrors: Record<string, string> = {
      LOYALTY_CUSTOMER_REQUIRED:
        "Benefit loyalty hanya bisa digunakan untuk customer terdaftar.",
      LOYALTY_NOT_ELIGIBLE:
        "Customer belum eligible untuk benefit loyalty.",
      LOYALTY_MILESTONE_RESERVED:
        "Milestone loyalty customer sedang reserved di transaksi pending.",
      LOYALTY_NOTE_REQUIRED:
        "Catatan atau alasan loyalty wajib diisi.",
      LOYALTY_VALUE_REQUIRED:
        "Nilai benefit loyalty wajib lebih dari 0.",
      LOYALTY_VALUE_INVALID:
        "Nilai benefit loyalty tidak boleh negatif.",
      LOYALTY_PERCENT_INVALID:
        "Persen benefit loyalty maksimal 100%.",
      LOYALTY_FIXED_TOO_HIGH:
        "Diskon loyalty nominal tidak boleh melebihi subtotal sebelum loyalty.",
      LOYALTY_MIN_PURCHASE_NOT_MET:
        `Minimal pembelian loyalty Rp ${LOYALTY_MIN_PURCHASE_AMOUNT.toLocaleString("id-ID")} belum terpenuhi. Pilih Tidak memberi benefit dengan alasan.`,
    };

    if (loyaltyErrors[message]) {
      return NextResponse.json(
        {
          message: loyaltyErrors[message],
        },
        {
          status: 422,
        },
      );
    }

    if (isMissingExpiredAtMigration(error)) {
      console.error(error);

      return NextResponse.json(
        {
          message:
            "Kolom expired_at belum tersedia di database. Jalankan migration terbaru sebelum membuat transaksi pending.",
        },
        {
          status: 500,
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
