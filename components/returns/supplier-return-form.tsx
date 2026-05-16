"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SupplierOption = {
  id: number;
  name: string;
  type: string;
};

type ProductOption = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  costPrice: number;
};

type SupplierReturnRow = {
  productId: string;
  qty: string;
};

type SupplierReturnFormProps = {
  suppliers: SupplierOption[];
  products: ProductOption[];
};

const TOKEN_KEY = "fishing_pos_token";

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function emptyRow(): SupplierReturnRow {
  return {
    productId: "",
    qty: "1",
  };
}

export default function SupplierReturnForm({
  suppliers,
  products,
}: SupplierReturnFormProps) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<SupplierReturnRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const total = useMemo(() => {
    return rows.reduce((sum, row) => {
      const product = productMap.get(Number(row.productId));
      const qty = Number(row.qty);

      if (!product || !Number.isFinite(qty)) {
        return sum;
      }

      return sum + qty * product.costPrice;
    }, 0);
  }, [productMap, rows]);

  function updateRow(index: number, next: Partial<SupplierReturnRow>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...next,
            }
          : row,
      ),
    );
  }

  async function submitSupplierReturn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!supplierId) {
      setError("Supplier/distributor wajib dipilih.");
      return;
    }

    if (!reason.trim()) {
      setError("Alasan retur supplier wajib diisi.");
      return;
    }

    const items = rows.map((row) => ({
      product_id: Number(row.productId),
      qty: Number(row.qty),
    }));

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.product_id) ||
          item.product_id <= 0 ||
          !Number.isInteger(item.qty) ||
          item.qty <= 0,
      )
    ) {
      setError("Pastikan produk dan qty sudah valid.");
      return;
    }

    setLoading(true);

    try {
      const token =
        typeof window === "undefined"
          ? ""
          : window.localStorage.getItem(TOKEN_KEY) ?? "";
      const response = await fetch("/api/returns/supplier", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          reason,
          notes,
          items,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal membuat retur supplier.");
      }

      setMessage(`Retur supplier berhasil dibuat: ${data.data?.return_number ?? ""}`);
      setSupplierId("");
      setReason("");
      setNotes("");
      setRows([emptyRow()]);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat retur supplier.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submitSupplierReturn}
      className="surface-panel space-y-5 rounded-3xl p-5 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">
          Retur ke Supplier / Distributor
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Stok akan berkurang dan tercatat sebagai stock movement keluar.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Supplier / Distributor
          </label>
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Pilih supplier/distributor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} - {supplier.type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Alasan
          </label>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Contoh: barang cacat dari supplier"
          />
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => {
          const product = productMap.get(Number(row.productId));

          return (
            <div
              key={index}
              className="surface-panel-soft grid gap-3 rounded-2xl p-4 md:grid-cols-[1fr_120px_auto]"
            >
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Produk
                </label>
                <select
                  value={row.productId}
                  onChange={(event) =>
                    updateRow(index, {
                      productId: event.target.value,
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="">Pilih produk</option>
                  {products.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku ?? "-"}) - stok {item.stock}
                    </option>
                  ))}
                </select>
                {product ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Cost: {rupiah(product.costPrice)} / stok sekarang{" "}
                    {product.stock}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Qty
                </label>
                <input
                  type="number"
                  min={1}
                  max={product?.stock}
                  value={row.qty}
                  onChange={(event) =>
                    updateRow(index, {
                      qty: event.target.value,
                    })
                  }
                  className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) =>
                      current.length === 1
                        ? [emptyRow()]
                        : current.filter((_, rowIndex) => rowIndex !== index),
                    )
                  }
                  className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Hapus
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setRows((current) => [...current, emptyRow()])}
        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Tambah Item
      </button>

      <div>
        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
          Catatan
        </label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          placeholder="Opsional"
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 pt-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Estimasi nilai stok keluar
          </p>
          <p className="metric-value mt-1 text-2xl">{rupiah(total)}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-2xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
        >
          {loading ? "Menyimpan..." : "Submit Retur Supplier"}
        </button>
      </div>
    </form>
  );
}
