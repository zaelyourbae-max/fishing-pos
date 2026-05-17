import AutoPrintInvoice from "@/components/invoice/auto-print-invoice";
import PrintInvoiceButton from "@/components/invoice/print-invoice-button";
import SaleMessageActions from "@/components/message-actions/sale-message-actions";
import { requireProtectedPage } from "@/lib/page-guards";
import { isOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import Link from "next/link";
import { notFound } from "next/navigation";

type InvoicePageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    print?: string;
  }>;
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function moneyNumber(amount: unknown) {
  return Math.round(Number(amount ?? 0));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function returnReasonLabel(reason: string) {
  return RETURN_REASON_LABELS[reason as ReturnReason] ?? reason;
}

function statusBadgeClass(status: string) {
  if (status === "SUCCESS" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "PENDING" || status === "WAITING_PROOF") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return "bg-rose-50 text-rose-700";
  }

  return "bg-zinc-100 text-zinc-700";
}

export default async function InvoicePage({
  params,
  searchParams,
}: InvoicePageProps) {
  const session = await requireProtectedPage();
  const { id } = await params;
  const shouldPrint = (await searchParams)?.print === "1";
  const sale = await prisma.sale.findFirst({
    where: {
      id,
      ...(session.role === "cashier" ? { cashierId: session.sub } : {}),
    },
    include: {
      cashier: {
        select: {
          name: true,
          email: true,
        },
      },
      customer: {
        select: {
          name: true,
          phone: true,
          customerCode: true,
        },
      },
      paymentProofUploadedBy: {
        select: {
          name: true,
          email: true,
        },
      },
      cancelledBy: {
        select: {
          name: true,
          email: true,
        },
      },
      items: {
        select: {
          id: true,
          qty: true,
          price: true,
          subtotal: true,
          originalPrice: true,
          discountType: true,
          discountValue: true,
          discountAmount: true,
          discountReason: true,
          subtotalBeforeDiscount: true,
          subtotalAfterDiscount: true,
          product: {
            select: {
              name: true,
              sku: true,
            },
          },
        },
        orderBy: {
          id: "asc",
        },
      },
      returns: {
        where: {
          returnType: "CUSTOMER_RETURN",
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!sale) {
    notFound();
  }

  const canViewProofAudit = isOwnerRole(session.role);
  const totalQty = sale.items.reduce((total, item) => total + item.qty, 0);
  const totalItemDiscount = sale.items.reduce(
    (total, item) => total + moneyNumber(item.discountAmount),
    0,
  );
  const subtotalBeforeDiscount = sale.items.reduce((total, item) => {
    const storedSubtotal = moneyNumber(item.subtotalBeforeDiscount);

    return total + (storedSubtotal > 0 ? storedSubtotal : item.price * item.qty);
  }, 0);
  const changeAmount = Math.max(sale.paidAmount - sale.subtotal, 0);
  const totalReturn = sale.returns.reduce(
    (total, saleReturn) => total + (saleReturn.totalRefund ?? 0),
    0,
  );
  const paymentMethod = await prisma.paymentMethod.findUnique({
    where: {
      code: sale.paymentMethod,
    },
    select: {
      name: true,
    },
  });

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 print:bg-white print:px-0 print:py-0 sm:px-6">
      <AutoPrintInvoice enabled={shouldPrint} />
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/pos"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-semibold hover:bg-zinc-50"
          >
            Back to POS
          </Link>

          <PrintInvoiceButton />
        </div>
        <div className="mb-4 print:hidden">
          <SaleMessageActions saleId={sale.id} />
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-8">
          <header className="border-b border-zinc-200 pb-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-500">
                  Fishing POS
                </p>
                <h1 className="mt-1 text-3xl font-bold">Invoice</h1>
                {sale.returns.length > 0 ? (
                  <span className="mt-3 inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    Ada Retur
                  </span>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(sale.transactionStatus)}`}>
                    {sale.transactionStatus}
                  </span>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(sale.paymentStatus)}`}>
                    {sale.paymentStatus}
                  </span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-sm text-zinc-500">Invoice Number</p>
                <p className="text-lg font-bold">{sale.invoiceNumber}</p>
              </div>
            </div>
          </header>

          <div className="grid gap-4 border-b border-zinc-200 py-5 text-sm sm:grid-cols-2">
            <div>
              <p className="text-zinc-500">Tanggal Transaksi</p>
              <p className="mt-1 font-semibold">{formatDate(sale.createdAt)}</p>
            </div>

            <div>
              <p className="text-zinc-500">Payment Method</p>
              <p className="mt-1 font-semibold capitalize">
                {paymentMethod?.name ?? sale.paymentMethod}
              </p>
            </div>

            <div>
              <p className="text-zinc-500">Payment Status</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(sale.paymentStatus)}`}>
                  {sale.paymentStatus}
                </span>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(sale.transactionStatus)}`}>
                  {sale.transactionStatus}
                </span>
              </div>
            </div>

            <div>
              <p className="text-zinc-500">Kasir</p>
              <p className="mt-1 font-semibold">{sale.cashier.name}</p>
              <p className="text-xs text-zinc-500">{sale.cashier.email}</p>
            </div>

            <div>
              <p className="text-zinc-500">Customer</p>
              {sale.customer ? (
                <>
                  <p className="mt-1 font-semibold">{sale.customer.name}</p>
                  <p className="text-xs text-zinc-500">
                    {sale.customer.customerCode}
                    {sale.customer.phone ? ` - ${sale.customer.phone}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-1 font-semibold">Walk-in Customer</p>
              )}
            </div>
          </div>

          {sale.transactionStatus === "CANCELLED" ? (
            <section className="border-b border-zinc-200 py-5">
              <h2 className="text-base font-bold text-rose-700">
                Transaksi Dibatalkan
              </h2>
              <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                  <p className="text-rose-500">Alasan</p>
                  <p className="mt-1 font-semibold text-rose-800">
                    {sale.cancelReason ?? "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-100 px-3 py-2">
                  <p className="text-zinc-500">Dibatalkan Pada</p>
                  <p className="mt-1 font-semibold">
                    {sale.cancelledAt ? formatDate(sale.cancelledAt) : "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-100 px-3 py-2 sm:col-span-2">
                  <p className="text-zinc-500">Dibatalkan Oleh</p>
                  <p className="mt-1 font-semibold">
                    {sale.cancelledBy?.name ?? "-"}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {sale.paymentProofUrl ? (
            <section className="border-b border-zinc-200 py-5">
              <h2 className="text-base font-bold">Bukti Pembayaran QRIS</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sale.paymentProofUrl}
                  alt="Bukti pembayaran QRIS"
                  className="max-h-64 w-full rounded-xl border border-zinc-200 bg-white object-contain p-2"
                />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2">
                    <span className="text-zinc-500">Proof URL</span>
                    <span className="max-w-[220px] truncate text-right font-semibold">
                      {sale.paymentProofUrl}
                    </span>
                  </div>
                  {canViewProofAudit ? (
                    <>
                      <div className="flex justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2">
                        <span className="text-zinc-500">Uploaded At</span>
                        <span className="text-right font-semibold">
                          {sale.paymentProofUploadedAt
                            ? formatDate(sale.paymentProofUploadedAt)
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 rounded-xl border border-zinc-100 px-3 py-2">
                        <span className="text-zinc-500">Uploaded By</span>
                        <span className="text-right font-semibold">
                          {sale.paymentProofUploadedBy?.name ?? "-"}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-b border-zinc-200 text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-3 pr-3 font-medium">Item</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Harga</th>
                  <th className="px-3 py-3 text-right font-medium">Diskon</th>
                  <th className="py-3 pl-3 text-right font-medium">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id} className="border-t border-zinc-100">
                    <td className="py-3 pr-3">
                      <p className="font-semibold">{item.product.name}</p>
                      <p className="text-xs text-zinc-500">
                        {item.product.sku ?? "-"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">{item.qty}</td>
                    <td className="px-3 py-3 text-right">
                      {rupiah(item.price)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {moneyNumber(item.discountAmount) > 0 ? (
                        <div>
                          <p className="font-semibold text-rose-700">
                            -{rupiah(moneyNumber(item.discountAmount))}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {item.discountType === "PERCENT"
                              ? `${moneyNumber(item.discountValue)}%`
                              : item.discountType === "FIXED"
                                ? "Nominal"
                                : ""}
                          </p>
                          {item.discountReason ? (
                            <p className="mt-1 text-xs text-zinc-500">
                              {item.discountReason}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right font-semibold">
                      {rupiah(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Total Qty</span>
              <span className="font-semibold">{totalQty}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Subtotal</span>
              <span className="font-semibold">
                {rupiah(subtotalBeforeDiscount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Diskon Item</span>
              <span className="font-semibold text-rose-700">
                -{rupiah(totalItemDiscount)}
              </span>
            </div>
            {sale.returns.length > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Total Retur</span>
                <span className="font-semibold text-rose-700">
                  -{rupiah(totalReturn)}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-zinc-200 pt-3 text-base">
              <span className="font-bold">Total</span>
              <span className="font-bold">{rupiah(sale.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Dibayar</span>
              <span className="font-semibold">{rupiah(sale.paidAmount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Kembali</span>
              <span className="font-semibold">{rupiah(changeAmount)}</span>
            </div>
          </div>

          {sale.returns.length > 0 ? (
            <section className="mt-8 border-t border-zinc-200 pt-5">
              <h2 className="text-base font-bold">Item Retur</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      <th className="py-2 pr-3 font-medium">Tanggal</th>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 text-right font-medium">Qty</th>
                      <th className="px-3 py-2 text-right font-medium">Nilai</th>
                      <th className="py-2 pl-3 font-medium">Alasan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.returns.flatMap((saleReturn) =>
                      saleReturn.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-zinc-100 text-zinc-700"
                        >
                          <td className="py-2 pr-3">
                            {formatDate(saleReturn.createdAt)}
                          </td>
                          <td className="px-3 py-2">
                            <p className="font-semibold">{item.product.name}</p>
                            <p className="text-xs text-zinc-500">
                              {item.product.sku ?? "-"}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-right">{item.qty}</td>
                          <td className="px-3 py-2 text-right">
                            {rupiah(item.subtotal)}
                          </td>
                          <td className="py-2 pl-3">
                            {returnReasonLabel(saleReturn.reason)}
                            {saleReturn.notes ? (
                              <p className="text-xs text-zinc-500">
                                {saleReturn.notes}
                              </p>
                            ) : null}
                          </td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <footer className="mt-8 border-t border-zinc-200 pt-5 text-center text-xs text-zinc-500">
            Terima kasih sudah berbelanja.
          </footer>
        </section>
      </div>
    </main>
  );
}
