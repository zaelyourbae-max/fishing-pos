import AutoPrintInvoice from "@/components/invoice/auto-print-invoice";
import PrintInvoiceButton from "@/components/invoice/print-invoice-button";
import SaleMessageActions from "@/components/message-actions/sale-message-actions";
import { requireProtectedPage } from "@/lib/page-guards";
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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function returnReasonLabel(reason: string) {
  return RETURN_REASON_LABELS[reason as ReturnReason] ?? reason;
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

  const totalQty = sale.items.reduce((total, item) => total + item.qty, 0);
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-b border-zinc-200 text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-3 pr-3 font-medium">Item</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 text-right font-medium">Harga</th>
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
              <span className="font-semibold">{rupiah(sale.subtotal)}</span>
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
