"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { RETURN_REASON_LABELS, RETURN_REASONS, rupiah } from "@/lib/returns";

type SaleSearchItem = {
  id: string;
  invoice_number: string;
  created_at: string;
  subtotal: number;
  payment_method?: string;
  item_count?: number;
  cashier: {
    name: string;
  };
  customer: {
    name: string;
    phone: string | null;
  } | null;
  items: {
    id: string;
    product_id: number;
    product_name: string;
    product_sku: string | null;
    qty_sold: number;
    qty_returned: number;
    max_return_qty: number;
    price: number;
    subtotal: number;
  }[];
};

type QtyMap = Record<string, string>;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function ReturnForm() {
  const [query, setQuery] = useState("");
  const [sales, setSales] = useState<SaleSearchItem[]>([]);
  const [suggestions, setSuggestions] = useState<SaleSearchItem[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleSearchItem | null>(null);
  const [qtyByItem, setQtyByItem] = useState<QtyMap>({});
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selectedItems = useMemo(() => {
    if (!selectedSale) {
      return [];
    }

    return selectedSale.items
      .map((item) => ({
        sale_item_id: item.id,
        qty: Number(qtyByItem[item.id] ?? 0),
        price: item.price,
      }))
      .filter((item) => Number.isInteger(item.qty) && item.qty > 0);
  }, [qtyByItem, selectedSale]);
  const estimatedRefund = selectedItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0,
  );

  function selectSale(sale: SaleSearchItem) {
    setSelectedSale(sale);
    setQtyByItem({});
    setShowSuggestions(false);
    setSuggestions([]);
  }

  const searchSales = useCallback(async (searchQuery: string) => {
    const response = await fetch(
      `/api/sales/search-for-return?query=${encodeURIComponent(searchQuery)}`,
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.message ?? "Gagal mencari transaksi.");
    }

    return (payload.data ?? []) as SaleSearchItem[];
  }, []);

  useEffect(() => {
    const keyword = query.trim();

    if (keyword.length < 2) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const result = await searchSales(keyword);
        setSuggestions(result);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, searchSales]);

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoadingSearch(true);

    try {
      const result = await searchSales(query);
      setSales(result);
      setSelectedSale(null);
      setQtyByItem({});
      setShowSuggestions(false);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Gagal mencari transaksi.",
      );
    } finally {
      setLoadingSearch(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedSale) {
      setError("Pilih transaksi terlebih dahulu.");
      return;
    }

    setError("");
    setMessage("");
    setLoadingSubmit(true);

    const response = await fetch("/api/returns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sale_id: selectedSale.id,
        reason,
        notes,
        items: selectedItems,
      }),
    });
    const payload = await response.json();
    setLoadingSubmit(false);

    if (!response.ok) {
      setError(payload.message ?? "Gagal membuat retur.");
      return;
    }

    setMessage(`Retur berhasil dibuat untuk ${payload.data.invoice_number}.`);
    setSelectedSale(null);
    setSales([]);
    setQtyByItem({});
    setReason("");
    setNotes("");
    setQuery("");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Buat Retur</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Cari transaksi, pilih item, lalu catat alasan retur.
          </p>
        </div>

        <Link
          href="/returns"
          className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Kembali
        </Link>
      </div>

      <form
        onSubmit={handleSearch}
        className="surface-panel grid gap-3 rounded-3xl p-4 sm:p-5 md:grid-cols-[1fr_auto]"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);

              if (value.trim().length < 2) {
                setSuggestions([]);
                setShowSuggestions(false);
                setLoadingSuggestions(false);
              } else {
                setShowSuggestions(true);
                setLoadingSuggestions(true);
              }
            }}
            onFocus={() => {
              if (query.trim().length >= 2) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                setSuggestions([]);
                setShowSuggestions(false);
                setLoadingSuggestions(false);
              }
            }}
            className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            placeholder="Cari invoice, customer, WhatsApp, atau kasir"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setShowSuggestions(false);
                setLoadingSuggestions(false);
              }}
              className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Bersihkan pencarian"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {showSuggestions && query.trim().length >= 2 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {loadingSuggestions ? (
                <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  Mencari transaksi...
                </div>
              ) : suggestions.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  Tidak ada transaksi ditemukan.
                </div>
              ) : (
                suggestions.map((sale) => (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => selectSale(sale)}
                    className="block w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {sale.invoice_number}
                        </p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {sale.customer?.name ?? "Tanpa nama"}
                          {sale.customer?.phone ? ` - ${sale.customer.phone}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(sale.created_at)} -{" "}
                          {sale.payment_method ?? "-"} -{" "}
                          {sale.item_count ?? sale.items.length} item
                        </p>
                      </div>
                      <p className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                        {rupiah(sale.subtotal)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <button
          disabled={loadingSearch}
          className="rounded-2xl bg-teal-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
        >
          {loadingSearch ? "Mencari..." : "Cari Transaksi"}
        </button>
      </form>

      {error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-100 p-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-100 p-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
          {message}
        </div>
      ) : null}

      {sales.length > 0 ? (
        <section className="surface-panel rounded-3xl p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">
            Pilih Transaksi
          </h2>
          <div className="mt-5 grid gap-3">
            {sales.map((sale) => (
              <button
                type="button"
                key={sale.id}
                onClick={() => {
                  selectSale(sale);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedSale?.id === sale.id
                    ? "border-teal-500 bg-teal-600/10"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{sale.invoice_number}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(sale.created_at)} - {sale.customer?.name ?? "Walk-in"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Kasir: {sale.cashier.name}
                    </p>
                  </div>
                  <p className="metric-value">{rupiah(sale.subtotal)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {selectedSale ? (
        <form
          onSubmit={handleSubmit}
          className="surface-panel space-y-6 rounded-3xl p-5 sm:p-6"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-xl">
              Item Retur - {selectedSale.invoice_number}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Isi qty hanya pada item yang diretur.
            </p>
          </div>

          <div className="hidden md:block">
          <div className="table-scroll">
            <table className="min-w-[820px] w-full text-sm">
              <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="p-4 text-left">Produk</th>
                  <th className="p-4 text-right">Terjual</th>
                  <th className="p-4 text-right">Sudah Retur</th>
                  <th className="p-4 text-right">Maks Retur</th>
                  <th className="p-4 text-right">Harga</th>
                  <th className="p-4 text-right">Qty Retur</th>
                </tr>
              </thead>
              <tbody>
                {selectedSale.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="p-4">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{item.product_name}</p>
                      <p className="text-xs text-slate-500">
                        {item.product_sku ?? "-"}
                      </p>
                    </td>
                    <td className="p-4 text-right tabular-nums text-slate-700 dark:text-slate-300">{item.qty_sold}</td>
                    <td className="p-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.qty_returned}
                    </td>
                    <td className="p-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {item.max_return_qty}
                    </td>
                    <td className="p-4 text-right tabular-nums text-slate-700 dark:text-slate-300">
                      {rupiah(item.price)}
                    </td>
                    <td className="p-4 text-right">
                      <input
                        type="number"
                        min={0}
                        max={item.max_return_qty}
                         value={qtyByItem[String(item.id)] ?? ""}
                         onChange={(event) => {
                           const value = event.target.value;

                        if (value === "") {
                         setQtyByItem((current) => ({
                         ...current,
                        [String(item.id)]: "",
                       }));
                     return;
                       }

                      const numericValue = Number(value);

                        if (Number.isNaN(numericValue)) return;
                        if (numericValue < 0) return;
                        if (numericValue > item.max_return_qty) return;

                          setQtyByItem((current) => ({
                          ...current,
                        [String(item.id)]: value,
                       }));
                       }}
                      disabled={item.max_return_qty <= 0}
                    className="w-24 rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                       />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          <div className="mobile-card-list rounded-2xl border border-slate-200 md:hidden dark:border-slate-800">
            {selectedSale.items.map((item) => (
              <article key={item.id} className="mobile-data-card">
                <div className="min-w-0">
                  <p className="break-words font-semibold text-slate-900 dark:text-slate-100">
                    {item.product_name}
                  </p>
                  <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                    {item.product_sku ?? "-"}
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Terjual
                    </span>
                    <span className="font-semibold tabular-nums">{item.qty_sold}</span>
                  </p>
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Sudah Retur
                    </span>
                    <span className="font-semibold tabular-nums">{item.qty_returned}</span>
                  </p>
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Maks Retur
                    </span>
                    <span className="font-semibold tabular-nums">{item.max_return_qty}</span>
                  </p>
                  <p>
                    <span className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Harga
                    </span>
                    <span className="font-semibold tabular-nums">{rupiah(item.price)}</span>
                  </p>
                </div>
                <label className="mt-4 block">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Qty Retur
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={item.max_return_qty}
                    value={qtyByItem[String(item.id)] ?? ""}
                    onChange={(event) => {
                      const value = event.target.value;

                      if (value === "") {
                        setQtyByItem((current) => ({
                          ...current,
                          [String(item.id)]: "",
                        }));
                        return;
                      }

                      const numericValue = Number(value);

                      if (Number.isNaN(numericValue)) return;
                      if (numericValue < 0) return;
                      if (numericValue > item.max_return_qty) return;

                      setQtyByItem((current) => ({
                        ...current,
                        [String(item.id)]: value,
                      }));
                    }}
                    disabled={item.max_return_qty <= 0}
                    className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-900 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
                  />
                </label>
              </article>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Alasan Retur
              </label>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Pilih alasan</option>
                {RETURN_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {RETURN_REASON_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Notes {reason === "LAINNYA" ? "(wajib)" : "(optional)"}
              </label>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Catatan retur"
              />
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-200 dark:border-slate-800 pt-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total estimasi refund</p>
              <p className="metric-value mt-1 text-3xl">
                {rupiah(estimatedRefund)}
              </p>
            </div>

            <button
              disabled={loadingSubmit}
              className="rounded-2xl bg-teal-600 px-7 py-4 font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              {loadingSubmit ? "Menyimpan..." : "Submit Retur"}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-sm text-slate-400">
          Cari dan pilih transaksi untuk mulai membuat retur.
        </div>
      )}
    </div>
  );
}
