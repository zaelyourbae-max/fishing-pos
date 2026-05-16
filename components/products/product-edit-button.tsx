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
    price: number;
    costPrice: number;
    stock: number;
    minStock: number;
    unit: string;
    category: string | null;
    description: string | null;
    imageUrl: string | null;
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
    price: String(product.price),
    costPrice: String(product.costPrice),
    stock: String(product.stock),
    minStock: String(product.minStock),
    unit: product.unit,
    category: product.category ?? "",
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
          stock: Number(form.stock),
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
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
      >
        <Pencil size={16} />
        Edit
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <form
            onSubmit={submit}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 text-slate-950 dark:bg-slate-900 dark:text-slate-50"
          >
            <div className="mb-5">
              <h2 className="text-xl font-semibold">Edit Produk</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Kategori/laci baru bisa langsung diketik.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <input
                value={form.sku}
                onChange={(event) => updateForm("sku", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="SKU"
              />
              <input
                value={form.barcode}
                onChange={(event) => updateForm("barcode", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Barcode"
              />
              <input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Nama produk"
              />
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(event) => updateForm("price", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Harga jual"
              />
              <input
                type="number"
                min="0"
                value={form.costPrice}
                onChange={(event) => updateForm("costPrice", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Harga beli"
              />
              <input
                type="number"
                min="0"
                value={form.stock}
                onChange={(event) => updateForm("stock", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Stok"
              />
              <input
                type="number"
                min="0"
                value={form.minStock}
                onChange={(event) => updateForm("minStock", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Min stok"
              />
              <input
                value={form.unit}
                onChange={(event) => updateForm("unit", event.target.value)}
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Unit"
              />
              <input
                value={form.category}
                onChange={(event) => updateForm("category", event.target.value)}
                list="product-categories"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Kategori / laci"
              />
              <datalist id="product-categories">
                {categories.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>

            <textarea
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              className="mt-4 min-h-24 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
              placeholder="Catatan produk"
            />

            <div className="mt-4">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Foto Produk
              </label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div
                  className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-50 bg-contain bg-center bg-no-repeat dark:border-slate-800 dark:bg-slate-950"
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
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-950"
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

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="btn-secondary"
              >
                Batal
              </button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
