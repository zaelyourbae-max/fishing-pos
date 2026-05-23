"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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

export default function CreateProductForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [type, setType] = useState("");
  const [size, setSize] = useState("");
  const [variant, setVariant] = useState("");
  const [supplier, setSupplier] = useState("");
  const [rackLocation, setRackLocation] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("0");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageInputKey, setImageInputKey] = useState(0);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    try {
      const imageUrl = imageFile ? await uploadProductImage(imageFile) : "";
      const response = await fetch(
        "/api/products",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            sku,
            barcode,
            category,
            brand,
            type,
            size,
            variant,
            supplier,
            rackLocation,
            unit,
            price,
            costPrice,
            stock,
            minStock,
            description,
            imageUrl,
          }),
        }
      );

      if (response.ok) {
        alert("Produk berhasil ditambahkan");

        router.push("/products");
        router.refresh();
      } else {
        const payload = await response.json().catch(() => ({}));
        alert(payload.message ?? payload.error ?? "Gagal tambah produk");
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal tambah produk");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="page-title">
        Tambah Produk
      </h1>

      <p className="text-slate-400 mt-3">
        Tambahkan produk baru
      </p>

      <form
        onSubmit={handleSubmit}
        className="surface-panel mt-8 space-y-6 rounded-3xl p-5 sm:p-8"
      >
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Identitas
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Nama Produk *</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Nama produk"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Kategori *</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Joran, Reel, Kail, PE, Nilon, Leader, Umpan"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">SKU</span>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Opsional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Barcode</span>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Opsional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Brand</span>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Opsional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Type</span>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Opsional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Size</span>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Opsional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Variant</span>
              <input
                type="text"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Opsional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Supplier</span>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Opsional"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Lokasi Rak</span>
              <input
                type="text"
                value={rackLocation}
                onChange={(e) => setRackLocation(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Contoh: A-01"
              />
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Harga &amp; Stok
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Satuan Utama *</span>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="pcs, meter, gram, kg, pack, roll, dll"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Harga Jual / sellPrice *</span>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Harga jual"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">HPP / costPrice *</span>
              <input
                type="number"
                min={0}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Harga modal / HPP"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Digunakan untuk menghitung laba dan margin. Tidak ditampilkan ke kasir.
              </p>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Stok *</span>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Jumlah stok"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-slate-600 dark:text-slate-300">Min Stok *</span>
              <input
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Batas stok rendah"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Gunakan 1 satuan utama per produk. Contoh: joran = pcs, tali = meter, timah = gram, PE = pack.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Opsional
          </h2>
          <label className="space-y-2">
            <span className="text-sm text-slate-600 dark:text-slate-300">Deskripsi</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              placeholder="Catatan tambahan produk"
            />
          </label>
        </section>

        <div>
          <label className="text-sm text-slate-300">
            Foto Produk
          </label>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div
              className="h-24 w-24 rounded-xl border border-slate-200 bg-slate-50 bg-contain bg-center bg-no-repeat dark:border-slate-800 dark:bg-slate-900"
              style={{
                backgroundImage: imagePreview ? `url("${imagePreview}")` : undefined,
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
                  setImagePreview(file ? URL.createObjectURL(file) : "");
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
              {imageFile ? (
                <button
                  type="button"
                  onClick={() => {
                    if (imagePreview.startsWith("blob:")) {
                      URL.revokeObjectURL(imagePreview);
                    }
                    setImageFile(null);
                    setImagePreview("");
                    setImageInputKey((key) => key + 1);
                  }}
                  className="mt-2 text-sm font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-300"
                >
                  Hapus foto
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors duration-150 hover:bg-teal-700"
        >
          Simpan Produk
        </button>
      </form>
    </div>
  );
}
