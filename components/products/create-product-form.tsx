"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatRupiahInput, normalizeRupiahInput, parseRupiahInput } from "@/lib/rupiah-input";

export default function CreateProductForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [variant, setVariant] = useState("");
  const [supplier, setSupplier] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("0");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [description, setDescription] = useState("");

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    try {
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
            variant,
            supplier,
            unit,
            price: parseRupiahInput(price),
            costPrice: parseRupiahInput(costPrice),
            stock,
            minStock,
            description,
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
                placeholder="Opsional, bisa distributor atau toko kecil"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Boleh diisi sederhana sebagai asal barang.
              </p>
            </label>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Harga &amp; Stok
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Satuan Barang *</span>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="pcs, meter, gram, kg, pack, roll, dll"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Harga Jual *</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatRupiahInput(price)}
                onChange={(e) => setPrice(normalizeRupiahInput(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Contoh: 50.000"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Harga Modal *</span>
              <input
                type="text"
                inputMode="numeric"
                value={formatRupiahInput(costPrice)}
                onChange={(e) => setCostPrice(normalizeRupiahInput(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Contoh: 35.000"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Stok Awal *</span>
              <input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Contoh: 20"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Jumlah barang yang ada sekarang. Untuk tambah stok nanti, pakai menu Pembelian.
              </p>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Stok Minimal *</span>
              <input
                type="number"
                min={0}
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
                placeholder="Contoh: 5"
              />
            </label>
          </div>
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

        <div className="flex flex-col gap-3 sm:flex-row-reverse sm:justify-start">
          <button
            type="submit"
            className="w-full rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white transition-colors duration-150 hover:bg-teal-700 sm:w-auto"
          >
            Simpan Produk
          </button>
          <Link
            href="/products"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:w-auto"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
