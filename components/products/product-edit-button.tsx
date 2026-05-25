"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ProductEditButtonProps = {
  product: {
    id: number;
    sku: string | null;
    barcode: string | null;
    name: string;
    brand: string | null;
    type: string | null;
    size: string | null;
    variant: string | null;
    price: number;
    costPrice: number;
    stock: number;
    minStock: number;
    unit: string;
    category: string | null;
    supplierName: string | null;
    rackLocation: string | null;
    description: string | null;
    imageUrl: string | null;
    hasStockHistory: boolean;
  };
  categories: string[];
};

async function uploadProductImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/products/images", {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? "Gagal upload foto produk.");
  }

  return String(payload.data?.imageUrl ?? "");
}

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
    type: product.type ?? "",
    size: product.size ?? "",
    variant: product.variant ?? "",
    price: String(product.price),
    costPrice: String(product.costPrice),
    stock: String(product.stock),
    minStock: String(product.minStock),
    unit: product.unit,
    category: product.category ?? "",
    supplier: product.supplierName ?? "",
    rackLocation: product.rackLocation ?? "",
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(product.imageUrl ?? "");
  const [imageInputKey, setImageInputKey] = useState(0);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

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
      const uploadedImageUrl = imageFile
        ? await uploadProductImage(imageFile)
        : form.imageUrl;
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...form,
          price: Number(form.price),
          costPrice: Number(form.costPrice),
          stock: product.stock,
          minStock: Number(form.minStock),
          imageUrl: uploadedImageUrl,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.message ?? "Gagal update produk.");
      }

      setOpen(false);
      setImageFile(null);
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={submit}
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 text-slate-950 dark:bg-slate-900 dark:text-slate-50 sm:rounded-2xl sm:p-5"
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
                  value={form.type}
                  onChange={(event) => updateForm("type", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Type"
                />
                <input
                  value={form.size}
                  onChange={(event) => updateForm("size", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Size"
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
                <input
                  value={form.rackLocation}
                  onChange={(event) => updateForm("rackLocation", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Lokasi rak"
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
                Harga, HPP &amp; Satuan
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-4">
                <input
                  value={form.unit}
                  onChange={(event) => updateForm("unit", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Unit utama (pcs, meter, gram, dll)"
                />
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(event) => updateForm("price", event.target.value)}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  placeholder="Harga jual / sellPrice"
                />
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Harga Modal / HPP
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.costPrice}
                    onChange={(event) => updateForm("costPrice", event.target.value)}
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                    placeholder="Harga modal / HPP"
                  />
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Digunakan untuk menghitung laba dan margin. Tidak ditampilkan ke kasir.
                  </span>
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Batas stok rendah
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.minStock}
                    onChange={(event) => updateForm("minStock", event.target.value)}
                    className="min-h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                    placeholder="Min stok"
                  />
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Mengatur batas peringatan stok rendah, bukan koreksi stok fisik.
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
                Catatan &amp; Foto
              </h3>
              <textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                className="min-h-20 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:min-h-24 sm:px-4 sm:py-3"
                placeholder="Catatan produk"
              />
            </section>

            <div className="mt-3 sm:mt-4">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 sm:text-sm">
                Foto Produk
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div
                  className="h-20 w-20 rounded-xl border border-slate-200 bg-slate-50 bg-contain bg-center bg-no-repeat dark:border-slate-800 dark:bg-slate-950 sm:h-24 sm:w-24"
                  style={{
                    backgroundImage: imagePreview
                      ? `url("${imagePreview}")`
                      : undefined,
                  }}
                >
                  {!imagePreview ? (
                    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-slate-400">
                      Preview
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <input
                    key={imageInputKey}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setImageFile(file);
                      setImagePreview(
                        file ? URL.createObjectURL(file) : form.imageUrl,
                      );
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950 sm:px-4 sm:py-3"
                  />
                  {imagePreview ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (imagePreview.startsWith("blob:")) {
                          URL.revokeObjectURL(imagePreview);
                        }
                        setImageFile(null);
                        setImagePreview("");
                        setImageInputKey((key) => key + 1);
                        updateForm("imageUrl", "");
                      }}
                      className="mt-2 text-sm font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300"
                    >
                      Hapus foto
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2.5 sm:mt-5 sm:flex-row sm:justify-end sm:gap-3">
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
