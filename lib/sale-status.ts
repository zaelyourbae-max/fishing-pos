import { PaymentStatus, Prisma, TransactionStatus } from "@prisma/client";

export const FINAL_SALE_STATUS_WHERE = {
  transactionStatus: TransactionStatus.SUCCESS,
  paymentStatus: PaymentStatus.PAID,
} satisfies Prisma.SaleWhereInput;

export function resolveSaleStatuses(paymentMethod: string) {
  const method = paymentMethod.trim().toUpperCase();

  if (method === "CASH") {
    return {
      transactionStatus: TransactionStatus.SUCCESS,
      paymentStatus: PaymentStatus.PAID,
    };
  }

  if (method.includes("QRIS") || method.includes("TRANSFER") || method.includes("BANK")) {
    return {
      transactionStatus: TransactionStatus.PENDING,
      paymentStatus: PaymentStatus.WAITING_PROOF,
    };
  }

  return {
    transactionStatus: TransactionStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
  };
}

export function transactionStatusLabel(status: TransactionStatus | string) {
  if (status === TransactionStatus.SUCCESS) return "SUCCESS";
  if (status === TransactionStatus.PENDING) return "PENDING";
  if (status === TransactionStatus.CANCELLED) return "CANCELLED";

  return String(status);
}

export function paymentStatusLabel(status: PaymentStatus | string) {
  if (status === PaymentStatus.PAID) return "PAID";
  if (status === PaymentStatus.WAITING_PROOF) return "WAITING_PROOF";
  if (status === PaymentStatus.UNPAID) return "UNPAID";
  if (status === PaymentStatus.FAILED) return "FAILED";

  return String(status);
}
