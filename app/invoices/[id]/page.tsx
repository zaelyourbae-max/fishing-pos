import AutoPrintInvoice from "@/components/invoice/auto-print-invoice";
import FitToWidth from "@/components/invoice/fit-to-width";
import PaymentProofImage from "@/components/invoices/payment-proof-image";
import PrintInvoiceButton from "@/components/invoice/print-invoice-button";
// Disembunyikan sementara (menunggu integrasi AI):
// import SaleMessageActions from "@/components/message-actions/sale-message-actions";
import { requireProtectedPage } from "@/lib/page-guards";
import { formatDateTimeID } from "@/lib/date-format";
import { paymentProofEndpoint } from "@/lib/payment-proof-assets";
import { isOwnerRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { RETURN_REASON_LABELS, type ReturnReason } from "@/lib/returns";
import { operatorLabel } from "@/lib/transaction-identity";
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
  return formatDateTimeID(date);
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
  const settings = await getSettings();
  const storeName = settings.storeName || "Toko Pancing";
  const storeWa = settings.storeWhatsApp.trim();
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
          role: {
            select: {
              name: true,
              slug: true,
            },
          },
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
  const subtotalBeforeLoyalty =
    sale.subtotalBeforeLoyalty > 0
      ? sale.subtotalBeforeLoyalty
      : Math.max(subtotalBeforeDiscount - totalItemDiscount, 0);
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
  const paymentProofImageSrc = sale.paymentProofUrl
    ? paymentProofEndpoint(
        sale.id,
        `${sale.paymentProofUploadedAt?.getTime() ?? ""}:${sale.paymentProofUrl}`,
      )
    : "";

  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-6 text-zinc-950 print:bg-white print:px-0 print:py-0 sm:px-6">
      <AutoPrintInvoice enabled={shouldPrint} />
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 grid grid-cols-3 gap-2 print:hidden sm:flex sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/sales"
            className="rounded-xl border border-zinc-300 bg-white px-2 py-2 text-center text-xs font-semibold hover:bg-zinc-50 sm:px-4 sm:text-sm"
          >
            ← Kembali
          </Link>

          <div className="contents sm:flex sm:flex-wrap sm:gap-2">
            <a
              href={`/api/sales/${sale.id}/invoice/pdf`}
              download
              className="rounded-xl bg-teal-600 px-2 py-2 text-center text-xs font-semibold text-white hover:bg-teal-700 print:hidden sm:px-4 sm:text-sm"
            >
              Download PDF
            </a>
            <PrintInvoiceButton className="rounded-xl bg-teal-600 px-2 py-2 text-center text-xs font-semibold text-white hover:opacity-90 print:hidden sm:px-4 sm:text-sm" />
          </div>
        </div>
        {/* Disembunyikan sementara — menunggu integrasi AI (Send WhatsApp / Owner Report).
            Hidupkan lagi dengan membuka komentar di bawah saat fitur AI siap. */}
        {/* <div className="mb-4 print:hidden">
          <SaleMessageActions saleId={sale.id} />
        </div> */}

        <FitToWidth>
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm print:border-0 print:p-0 print:shadow-none sm:p-8">
          {/* HEADER */}
          <header className="mb-7 flex items-start justify-between border-b-2 border-teal-600 pb-5">
            <div>
              <p className="text-2xl font-extrabold tracking-tight text-slate-950">{storeName}</p>
              <p style={{fontSize:"9.5px",color:"#0F172A",opacity:0.45,marginTop:"4px",fontWeight:400}}>by Meijrverse°</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {sale.returns.length > 0 ? (
                  <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-600">Ada Retur</span>
                ) : null}
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(sale.transactionStatus)}`}>{sale.transactionStatus}</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(sale.paymentStatus)}`}>{sale.paymentStatus}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold tracking-widest text-teal-600">INVOICE</p>
              <p className="mt-1 text-xs font-bold tracking-wide text-slate-950">{sale.invoiceNumber}</p>
            </div>
          </header>

          {/* INFO GRID */}
          <div className="mb-7 grid gap-y-5 border-b border-slate-200 pb-6 sm:grid-cols-2 sm:gap-x-4">
            <div>
              <p style={{fontSize:"9.5px",color:"#94A3B8",marginBottom:"4px"}}>Tanggal Transaksi</p>
              <p className="text-sm font-semibold text-slate-950">{formatDate(sale.createdAt)}</p>
            </div>
            <div>
              <p style={{fontSize:"9.5px",color:"#94A3B8",marginBottom:"4px"}}>Payment Method</p>
              <p className="text-sm font-semibold text-slate-950">{paymentMethod?.name ?? sale.paymentMethod}</p>
            </div>
            <div>
              <p style={{fontSize:"9.5px",color:"#94A3B8",marginBottom:"4px"}}>Payment Status</p>
              <div className="flex flex-wrap gap-1.5">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(sale.paymentStatus)}`}>{sale.paymentStatus}</span>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(sale.transactionStatus)}`}>{sale.transactionStatus}</span>
              </div>
            </div>
            <div>
              <p style={{fontSize:"9.5px",color:"#94A3B8",marginBottom:"4px"}}>Operator</p>
              <p className="text-sm font-semibold text-slate-950">{sale.cashier.name?.trim() || "Operator"}</p>
            </div>
            <div className="sm:col-span-2">
              <p style={{fontSize:"9.5px",color:"#94A3B8",marginBottom:"4px"}}>Customer</p>
              {sale.customer ? (
                <>
                  <p className="text-sm font-semibold text-slate-950">{sale.customer.name}</p>
                  <p style={{fontSize:"8.5px",color:"#94A3B8",marginTop:"2px"}}>
                    {sale.customer.customerCode}{sale.customer.phone ? ` · ${sale.customer.phone}` : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm font-semibold text-slate-950">Walk-in Customer</p>
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
            <section className="border-b border-zinc-200 py-5 print:hidden">
              <h2 className="text-base font-bold">Bukti Pembayaran QRIS</h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
                <PaymentProofImage src={paymentProofImageSrc} />
                <div className="space-y-2 text-sm">
                  <a
                    href={paymentProofImageSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                  >
                    Buka bukti pembayaran
                  </a>
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

          {/* TABLE */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse">
              <thead>
                <tr className="bg-slate-950 text-left text-white">
                  <th className="px-2 py-2.5 text-xs font-bold" style={{width:"44%"}}>Item</th>
                  <th className="px-2 py-2.5 text-right text-xs font-bold">Qty</th>
                  <th className="px-2 py-2.5 text-right text-xs font-bold">Harga</th>
                  <th className="px-2 py-2.5 text-right text-xs font-bold">Diskon</th>
                  <th className="px-2 py-2.5 text-right text-xs font-bold">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item, idx) => (
                  <tr key={item.id} className={`border-b border-slate-200 ${idx % 2 === 1 ? "bg-slate-50" : "bg-white"}`}>
                    <td className="px-2 py-2.5 align-top">
                      <p className="text-xs font-bold text-slate-950">{item.product.name}</p>
                      <p style={{fontSize:"8px",color:"#94A3B8",marginTop:"2px"}}>{item.product.sku ?? "-"}</p>
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs text-slate-950">{item.qty}</td>
                    <td className="px-2 py-2.5 text-right text-xs text-slate-950">{rupiah(item.price)}</td>
                    <td className="px-2 py-2.5 text-right text-xs">
                      {moneyNumber(item.discountAmount) > 0 ? (
                        <div>
                          <p className="font-semibold text-rose-600">-{rupiah(moneyNumber(item.discountAmount))}</p>
                          <p style={{fontSize:"8px",color:"#94A3B8"}}>
                            {item.discountType === "PERCENT" ? `${moneyNumber(item.discountValue)}%` : item.discountType === "FIXED" ? "Nominal" : ""}
                          </p>
                          {item.discountReason ? <p style={{fontSize:"8px",color:"#94A3B8",marginTop:"2px"}}>{item.discountReason}</p> : null}
                        </div>
                      ) : (
                        <span style={{color:"#94A3B8"}}>-</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right text-xs font-bold text-slate-950">{rupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TOTALS */}
          <div className="ml-auto mt-5 w-64 space-y-1 text-xs text-slate-500">
            <div className="flex justify-between py-1">
              <span>Total Qty</span><span>{totalQty}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Subtotal</span><span>{rupiah(subtotalBeforeDiscount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Total Diskon Grosir</span><span className="font-semibold text-rose-600">-{rupiah(totalItemDiscount)}</span>
            </div>
            {sale.loyaltyApplied ? (
              <>
                <div className="flex justify-between py-1">
                  <span>Subtotal Sebelum Loyalty</span><span>{rupiah(subtotalBeforeLoyalty)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Diskon Loyalty{sale.loyaltyMilestone ? ` (ke-${sale.loyaltyMilestone})` : ""}</span>
                  <span className="font-semibold text-rose-600">-{rupiah(sale.loyaltyDiscountAmount)}</span>
                </div>
                {sale.loyaltyBenefitNote ? (
                  <div className="rounded border border-amber-100 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                    <span className="font-semibold">Catatan Loyalty: </span>{sale.loyaltyBenefitNote}
                  </div>
                ) : null}
              </>
            ) : null}
            {sale.returns.length > 0 ? (
              <div className="flex justify-between py-1">
                <span>Total Retur</span><span className="font-semibold text-rose-600">-{rupiah(totalReturn)}</span>
              </div>
            ) : null}
            {/* Grand Total */}
            <div className="flex justify-between rounded px-2 py-2 text-sm font-extrabold text-slate-950" style={{background:"#F0FDFB",borderTop:"1px solid #CCFBF1",borderBottom:"1px solid #CCFBF1",margin:"4px -8px"}}>
              <span>Grand Total</span><span>{rupiah(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Dibayar</span><span>{rupiah(sale.paidAmount)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>Kembali</span><span>{rupiah(changeAmount)}</span>
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

          <footer className="mt-9 border-t border-slate-200 pt-5">
            <p className="text-sm font-bold text-teal-600">Terima kasih sudah berbelanja.</p>
            {storeWa ? (
              <p style={{fontSize:"9px",color:"#94A3B8",marginTop:"4px"}}>Hubungi kami: wa.me/{storeWa}</p>
            ) : null}
            <div className="mt-4 flex justify-between border-t border-dashed border-slate-200 pt-3" style={{fontSize:"8px",fontWeight:500,color:"#B0BEC5"}}>
              <span>{storeName} by MeijrVerse°</span>
              <span>Halaman 1 dari 1</span>
            </div>
          </footer>
        </section>
        </FitToWidth>
      </div>
    </main>
  );
}
