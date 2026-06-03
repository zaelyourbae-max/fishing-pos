import { notFound } from "next/navigation";
import { requireOwnerPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";
import { formatDateTimeID } from "@/lib/date-format";
import PrintActions from "@/components/purchases/print-actions";

type Props = {
  params: Promise<{ id: string }>;
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default async function PurchasePrintPage({ params }: Props) {
  await requireOwnerPage();

  const { id } = await params;

  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: { select: { name: true } },
      user: { select: { name: true } },
      items: {
        include: {
          product: { select: { name: true, sku: true } },
        },
      },
    },
  });

  if (!purchase) {
    notFound();
  }

  const purchaseData = {
    purchaseNumber: purchase.purchaseNumber,
    supplierName: purchase.supplier.name,
    createdBy: purchase.user?.name ?? null,
    createdAt: formatDateTimeID(purchase.createdAt),
    notes: purchase.notes ?? null,
    total: purchase.total,
    items: purchase.items.map((item) => ({
      productName: item.product.name,
      sku: item.product.sku ?? null,
      qty: item.qty,
      costPrice: item.costPrice,
      subtotal: item.subtotal,
    })),
  };

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 20mm 15mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: 'Inter', sans-serif; background: #fff; color: #0f172a; margin: 0; padding: 0; }
      `}</style>

      <PrintActions purchase={purchaseData} />

      <div className="mx-auto max-w-3xl px-8 py-10 pt-20">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Purchase Order</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{purchase.purchaseNumber}</h1>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-slate-900">MEIJRVERSE°</p>
            <p className="text-xs text-slate-500">Retail System</p>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Kepada (Supplier)</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{purchase.supplier.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tanggal</p>
            <p className="mt-1 text-sm font-medium text-slate-700">{formatDateTimeID(purchase.createdAt)}</p>
            {purchase.user?.name ? (
              <>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Dicatat oleh</p>
                <p className="mt-0.5 text-sm font-medium text-slate-700">{purchase.user.name}</p>
              </>
            ) : null}
          </div>
        </div>

        {purchase.notes ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Catatan</p>
            <p className="mt-1 text-sm text-slate-700">{purchase.notes}</p>
          </div>
        ) : null}

        {/* Tabel items */}
        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-900">
              <th className="pb-2 text-left font-semibold text-slate-900">Produk</th>
              <th className="pb-2 text-left font-semibold text-slate-900">SKU</th>
              <th className="pb-2 text-right font-semibold text-slate-900">Qty</th>
              <th className="pb-2 text-right font-semibold text-slate-900">Harga Beli</th>
              <th className="pb-2 text-right font-semibold text-slate-900">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((item, i) => (
              <tr key={item.id} className={i % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                <td className="py-2.5 pl-2 font-medium text-slate-800">{item.product.name}</td>
                <td className="py-2.5 text-slate-500">{item.product.sku ?? "-"}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-700">{item.qty}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-700">{rupiah(item.costPrice)}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums font-semibold text-slate-900">{rupiah(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="mt-4 flex justify-end border-t-2 border-slate-900 pt-4">
          <div className="text-right">
            <p className="text-sm text-slate-500">Total Pembelian</p>
            <p className="text-3xl font-bold tabular-nums text-slate-900">{rupiah(purchase.total)}</p>
          </div>
        </div>

        {/* TTD */}
        <div className="mt-16 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs text-slate-400">Penerima</p>
            <div className="mt-10 border-t border-slate-300 pt-2">
              <p className="text-xs text-slate-500">({"                                   "})</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400">Dibuat oleh</p>
            <div className="mt-10 border-t border-slate-300 pt-2">
              <p className="text-xs text-slate-500">{purchase.user?.name ?? "(                                   )"}</p>
            </div>
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          Dokumen ini digenerate otomatis oleh sistem MEIJRVERSE° — {formatDateTimeID(new Date())}
        </p>
      </div>
    </>
  );
}
