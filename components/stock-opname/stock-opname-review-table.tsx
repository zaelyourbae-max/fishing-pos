"use client";

import { useMemo, useState } from "react";

export type StockOpnameItemRow = {
  id: string;
  productId: number;
  productSkuSnapshot: string | null;
  barcodeSnapshot: string | null;
  productNameSnapshot: string;
  categorySnapshot: string | null;
  unitSnapshot: string | null;
  systemStock: number;
  physicalStock: number | null;
  difference: number | null;
  costPriceSnapshot: number;
  notes: string | null;
};

type DraftEdit = {
  physicalStock: string;
  notes: string;
};

export default function StockOpnameReviewTable({
  sessionId,
  items,
  canEdit,
  onUpdated,
}: {
  sessionId: string;
  items: StockOpnameItemRow[];
  canEdit: boolean;
  onUpdated: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Record<string, DraftEdit>>({});
  const [loadingItem, setLoadingItem] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return items;
    }

    return items.filter((item) =>
      [
        item.productNameSnapshot,
        item.productSkuSnapshot,
        item.barcodeSnapshot,
        item.categorySnapshot,
      ]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized)),
    );
  }, [items, query]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  function draftFor(item: StockOpnameItemRow) {
    return (
      editing[item.id] ?? {
        physicalStock:
          item.physicalStock === null ? "" : String(item.physicalStock),
        notes: item.notes ?? "",
      }
    );
  }

  function validDraftStock(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const number = Number(trimmed);

    if (!Number.isInteger(number) || number < 0) {
      return null;
    }

    return number;
  }

  async function saveItem(item: StockOpnameItemRow) {
    const draft = draftFor(item);
    const physicalStock = validDraftStock(draft.physicalStock);

    if (physicalStock === null) {
      setError("Stok fisik wajib angka bulat >= 0.");
      return;
    }

    setLoadingItem(item.id);
    setError("");

    const response = await fetch(
      `/api/stock-opnames/${sessionId}/items/${item.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          physicalStock,
          notes: draft.notes,
        }),
      },
    );
    const payload = await response.json();

    setLoadingItem(null);

    if (!response.ok) {
      setError(payload.message ?? "Gagal menyimpan stok fisik.");
      return;
    }

    setEditing((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    onUpdated();
  }

  return (
    <section className="surface-panel overflow-hidden rounded-3xl">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Review Selisih
            </h2>
          </div>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Cari produk, SKU, barcode..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 lg:max-w-sm"
          />
        </div>
        {error ? (
          <p className="mt-4 text-sm font-medium text-rose-600 dark:text-rose-300">
            {error}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th className="px-4 py-3 max-sm:sticky max-sm:left-0 max-sm:z-20 max-sm:border-r max-sm:border-slate-200 max-sm:bg-slate-50 dark:max-sm:border-slate-800 dark:max-sm:bg-slate-900">
                Produk
              </th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-center">Stok Catatan</th>
              <th className="px-4 py-3 text-center">Stok Asli</th>
              <th className="px-4 py-3 text-center">Selisih Stok</th>
              <th className="px-4 py-3 text-center">Selisih Uang</th>
              <th className="px-4 py-3 text-center">Catatan</th>
              <th className="px-4 py-3 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {visibleItems.map((item) => {
              const draft = draftFor(item);
              const physicalStock = validDraftStock(draft.physicalStock);
              const difference =
                draft.physicalStock.trim() === "" || physicalStock === null
                  ? item.difference
                  : physicalStock - item.systemStock;
              const hasInvalidStock =
                draft.physicalStock.trim() !== "" && physicalStock === null;

              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 max-sm:sticky max-sm:left-0 max-sm:z-10 max-sm:border-r max-sm:border-slate-200 max-sm:bg-card dark:max-sm:border-slate-800">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.productNameSnapshot}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {item.productSkuSnapshot || "-"} / ID {item.productId}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {item.categorySnapshot || "-"}
                  </td>
                  <td className="px-4 py-3 text-center">{item.systemStock}</td>
                  <td className="px-4 py-3 text-center">
                    <input
                      value={draft.physicalStock}
                      disabled={!canEdit}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      onChange={(event) =>
                        setEditing((current) => ({
                          ...current,
                          [item.id]: {
                            ...draft,
                            physicalStock: event.target.value,
                          },
                        }))
                      }
                      className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-950"
                    />
                    {hasInvalidStock ? (
                      <div className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">
                        Angka bulat &gt;= 0
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-center text-base font-bold tabular-nums">
                    <span
                      className={
                        (difference ?? 0) === 0
                          ? "text-slate-500"
                          : (difference ?? 0) > 0
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-300"
                      }
                    >
                      {(difference ?? 0) > 0 ? `+${difference}` : (difference ?? "-")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-base font-bold tabular-nums">
                    {(difference ?? 0) === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : item.costPriceSnapshot === 0 ? (
                      <span
                        className="text-xs font-medium text-amber-600 dark:text-amber-400"
                        title="Harga modal belum diisi saat opname dibuat"
                      >
                        ⚠ Belum ada harga
                      </span>
                    ) : (
                      <span
                        className={
                          (difference ?? 0) > 0
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-rose-600 dark:text-rose-300"
                        }
                      >
                        {((difference ?? 0) * item.costPriceSnapshot).toLocaleString(
                          "id-ID",
                          { style: "currency", currency: "IDR", maximumFractionDigits: 0 },
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      value={draft.notes}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setEditing((current) => ({
                          ...current,
                          [item.id]: {
                            ...draft,
                            notes: event.target.value,
                          },
                        }))
                      }
                      className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-950"
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      disabled={
                        !canEdit || loadingItem === item.id || physicalStock === null
                      }
                      onClick={() => saveItem(item)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {loadingItem === item.id ? "Simpan..." : "Simpan"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <span>
          {filtered.length} item / halaman {currentPage} dari {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((value) => Math.max(value - 1, 1))}
            disabled={currentPage <= 1}
            className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-50 dark:border-slate-800"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((value) => Math.min(value + 1, pageCount))}
            disabled={currentPage >= pageCount}
            className="rounded-xl border border-slate-200 px-3 py-2 disabled:opacity-50 dark:border-slate-800"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
