"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRupiahInput, normalizeRupiahInput, parseRupiahInput } from "@/lib/rupiah-input";

type ProductEditButtonProps = {
  product: {
    id: number;
    sku: string | null;
    barcode: string | null;
    name: string;
    brand: string | null;
    variant: string | null;
    price: number;
    costPrice: number;
    stock: number;
    minStock: number;
    unit: string;
    category: string | null;
    supplierName: string | null;
    description: string | null;
    imageUrl: string | null;
    hasStockHistory: boolean;
  };
  categories: string[];
};

export default function ProductEditButton({
  product,
  categories,
}: ProductEditButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    name: product.name,
    brand: product.brand ?? "",
    variant: product.variant ?? "",
    price: String(product.price),
    costPrice: String(product.costPrice),
    stock: String(product.stock),
    minStock: String(product.minStock),
    unit: product.unit,
    category: product.category ?? "",
    supplier: product.supplierName ?? "",
    description: product.description ?? "",
  });

  function updateForm(key: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          price: parseRupiahInput(form.price),
          costPrice: parseRupiahInput(form.costPrice),
          stock: product.stock,
          minStock: Number(form.minStock),
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal update produk.");
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal update produk.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors duration-200 hover:border-teal-300 hover:bg-slate-50 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 lg:w-auto"
      >
        <Pencil size={16} />
        Edit Data
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={submit}
            data-mobile-sheet
            className="max-h-[92dvh] w-full max-w-2xl scroll-pb-28 overflow-y-auto overscroll-contain rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-slate-950 [-webkit-overflow-scrolling:touch] dark:bg-slate-900 dark:text-slate-50 sm:rounded-2xl sm:p-5"
          >
            <div className="mb-4 sm:mb-5">
              <h2 className="text-lg font-semibold sm:text-xl">Edit Data Produk</h2>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                Ubah identitas, harga, dan metadata produk. Perubahan stok
                dilakukan lewat Koreksi Stok.
              </p>
            </div>

            <section className="space-y-3 sm:space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">
                Identitas
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
                <input
                  value={form.name}
                  onChange={(event) => updateForm("name", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Nama produk"
                />
                <input
                  value={form.category}
                  onChange={(event) => updateForm("category", event.target.value)}
                  list="product-categories"
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Kategori / laci"
                />
                <input
                  value={form.sku}
                  onChange={(event) => updateForm("sku", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="SKU"
                />
                <input
                  value={form.barcode}
                  onChange={(event) => updateForm("barcode", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Barcode"
                />
                <input
                  value={form.brand}
                  onChange={(event) => updateForm("brand", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Brand"
                />
                <input
                  value={form.variant}
                  onChange={(event) => updateForm("variant", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Variant"
                />
                <input
                  value={form.supplier}
                  onChange={(event) => updateForm("supplier", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Supplier"
                />
              </div>
              <datalist id="product-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </section>

            <section className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">
                Harga &amp; Stok
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Satuan Barang
                  </span>
                  <input
                    value={form.unit}
                    onChange={(event) => updateForm("unit", event.target.value)}
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                    placeholder="pcs, meter, gram, kg, pack, roll, dll"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Harga Jual
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRupiahInput(form.price)}
                    onChange={(event) => updateForm("price", normalizeRupiahInput(event.target.value))}
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                    placeholder="Contoh: 50.000"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Harga Modal
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatRupiahInput(form.costPrice)}
                    onChange={(event) => updateForm("costPrice", normalizeRupiahInput(event.target.value))}
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                    placeholder="Contoh: 35.000"
                  />
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Harga beli dari supplier. Tidak terlihat oleh kasir.
                  </span>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Stok Minimal
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.minStock}
                    onChange={(event) => updateForm("minStock", event.target.value)}
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                    placeholder="Contoh: 5"
                  />
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Saat stok turun ke angka ini, sistem memberi peringatan.
                  </span>
                </label>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-500/30 dark:bg-amber-500/10 sm:px-4 sm:py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
                    Stok saat ini
                  </p>
                  <p className="mt-1 font-bold tabular-nums text-amber-900 dark:text-amber-100">
                    {product.stock} {product.unit}
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-100">
                    Gunakan Koreksi Stok untuk menyesuaikan stok fisik produk.
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gunakan 1 satuan utama per produk. Contoh: joran = pcs, tali = meter, timah = gram, PE = pack.
              </p>
            </section>

            <section className="mt-4 space-y-2.5 sm:mt-5 sm:space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 sm:text-base">
                Catatan
              </h3>
              <textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:min-h-24 sm:px-4 sm:py-3"
                placeholder="Catatan produk"
              />
            </section>

            <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 flex flex-col-reverse gap-2.5 border-t border-slate-200 bg-white/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:static sm:m-0 sm:mt-5 sm:flex-row sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="btn-secondary"
              >
                Batal
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Menyimpan..." : "Simpan Data Produk"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
