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
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("0");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("5");
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
            price,
            costPrice,
            stock,
            minStock,
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
        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">
            SKU
          </label>

          <input
            type="text"
            value={sku}
            onChange={(e) =>
              setSku(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Opsional"
          />
        </div>

        <div>
          <label className="text-sm text-slate-300">
            Barcode
          </label>

          <input
            type="text"
            value={barcode}
            onChange={(e) =>
              setBarcode(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Opsional"
          />
        </div>

        <div>
          <label className="text-sm text-slate-300">
            Nama Produk
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Nama produk"
          />
        </div>
        </div>

        <div>
          <label className="text-sm text-slate-300">
            Kategori / Laci
          </label>

          <input
            type="text"
            value={category}
            onChange={(e) =>
              setCategory(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Joran, Reel, Kail, PE, Nilon, Leader, Umpan"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">
            Harga Jual
          </label>

          <input
            type="number"
            value={price}
            onChange={(e) =>
              setPrice(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Harga produk"
          />
        </div>

        <div>
          <label className="text-sm text-slate-300">
            Harga Beli
          </label>

          <input
            type="number"
            value={costPrice}
            onChange={(e) =>
              setCostPrice(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Harga beli"
          />
        </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">
            Stok
          </label>

          <input
            type="number"
            value={stock}
            onChange={(e) =>
              setStock(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Jumlah stok"
          />
        </div>

        <div>
          <label className="text-sm text-slate-300">
            Min Stok
          </label>

          <input
            type="number"
            value={minStock}
            onChange={(e) =>
              setMinStock(e.target.value)
            }
            className="w-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Batas stok rendah"
          />
        </div>
        </div>

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
