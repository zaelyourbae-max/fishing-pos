"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

type SupplierOption = {
  id: number;
  name: string;
};

type ProductOption = {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  costPrice: number;
};

type PurchaseRow = {
  productId: string;
  quantity: string;
  costPrice: string;
};

type PurchaseFormProps = {
  suppliers: SupplierOption[];
  products: ProductOption[];
};

const TOKEN_KEY = "fishing_pos_token";

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function emptyRow(): PurchaseRow {
  return {
    productId: "",
    quantity: "1",
    costPrice: "0",
  };
}

export default function PurchaseForm({
  suppliers,
  products,
}: PurchaseFormProps) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<PurchaseRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const productMap = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => {
      const quantity = Number(row.quantity);
      const costPrice = Number(row.costPrice);

      if (!Number.isFinite(quantity) || !Number.isFinite(costPrice)) {
        return sum;
      }

      return sum + quantity * costPrice;
    }, 0);
  }, [rows]);

  function updateRow(index: number, next: Partial<PurchaseRow>) {
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

  function selectProduct(index: number, productId: string) {
    const product = productMap.get(Number(productId));

    updateRow(index, {
      productId,
      costPrice: product ? String(product.costPrice) : "0",
    });
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((current) =>
      current.length === 1
        ? [emptyRow()]
        : current.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  async function submitPurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!supplierId) {
      setError("Supplier wajib dipilih.");
      return;
    }

    const items = rows.map((row) => ({
      product_id: Number(row.productId),
      quantity: Number(row.quantity),
      cost_price: Number(row.costPrice),
    }));

    if (
      items.some(
        (item) =>
          !Number.isInteger(item.product_id) ||
          item.product_id <= 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0 ||
          !Number.isInteger(item.cost_price) ||
          item.cost_price < 0,
      )
    ) {
      setError("Pastikan produk, qty, dan harga beli sudah valid.");
      return;
    }

    setLoading(true);

    try {
      const token =
        typeof window === "undefined"
          ? ""
          : window.localStorage.getItem(TOKEN_KEY) ?? "";
      const response = await fetch("/api/purchases", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplier_id: Number(supplierId),
          notes,
          items,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal membuat pembelian.");
      }

      setMessage(
        `Pembelian berhasil: ${data.data?.purchase_number ?? "-"} (${rupiah(
          Number(data.data?.total ?? 0),
        )})`,
      );
      setRows([emptyRow()]);
      setNotes("");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat pembelian.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submitPurchase}
      className="surface-panel space-y-6 rounded-3xl p-5 sm:p-6"
    >
      {message ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
        Pembelian adalah jalur resmi untuk menambah stok barang lama. Setelah
        disimpan, stok produk otomatis bertambah sesuai qty.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Supplier</label>
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
          >
            <option value="">Pilih supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Opsional"
          />
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => {
          const selectedProduct = productMap.get(Number(row.productId));
          const lineTotal = Number(row.quantity) * Number(row.costPrice);

          return (
            <div
              key={index}
              className="surface-panel-soft grid gap-3 rounded-2xl p-4 lg:grid-cols-[1fr_120px_160px_140px_44px]"
            >
              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-400">Produk</label>
                <select
                  value={row.productId}
                  onChange={(event) => selectProduct(index, event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 outline-none dark:text-slate-100"
                >
                  <option value="">Pilih produk</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ""}
                    </option>
                  ))}
                </select>
                {selectedProduct ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Stok saat ini: {selectedProduct.stock}. Qty pembelian akan
                    menambah stok setelah disimpan.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-400">Qty</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={row.quantity}
                  onChange={(event) =>
                    updateRow(index, {
                      quantity: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 outline-none dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-400">Harga beli</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={row.costPrice}
                  onChange={(event) =>
                    updateRow(index, {
                      costPrice: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 outline-none dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 dark:text-slate-400">Subtotal</label>
                <p className="mt-4 font-semibold tabular-nums text-slate-950 dark:text-white">
                  {rupiah(Number.isFinite(lineTotal) ? lineTotal : 0)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => removeRow(index)}
                className="mt-6 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Hapus item"
              >
                <Trash2 size={18} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          <Plus size={16} />
          Tambah Item
        </button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="text-right">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total</p>
            <p className="metric-value text-2xl">{rupiah(total)}</p>
          </div>

          <button
            type="submit"
            disabled={loading || suppliers.length === 0 || products.length === 0}
            className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Simpan Stock-In"}
          </button>
        </div>
      </div>
    </form>
  );
}
