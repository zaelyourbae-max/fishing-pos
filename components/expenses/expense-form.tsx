"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Loader2 } from "lucide-react";
import { rupiah } from "@/lib/reports";
import { todayDateInput } from "@/lib/date-format";
import DatePicker from "@/components/ui/date-picker";
import Modal from "@/components/ui/modal";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ExpenseForm({ open, onClose }: Props) {
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const todayLocal = todayDateInput();
  const [date, setDate] = useState(todayLocal);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const categoryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/expenses/categories")
      .then((r) => r.json())
      .then((data) => setAllCategories(data.categories ?? []));
  }, []);

  // Setel ulang isian setiap kali form dibuka, supaya tidak menampilkan sisa input lama.
  useEffect(() => {
    if (open) {
      setCategory("");
      setAmount("");
      setDescription("");
      setDate(todayLocal);
      setError("");
      setShowSuggestions(false);
    }
  }, [open, todayLocal]);

  function handleCategoryChange(value: string) {
    setCategory(value);
    if (value.trim() === "") {
      setSuggestions(allCategories.slice(0, 8));
    } else {
      const filtered = allCategories.filter((c) =>
        c.toLowerCase().includes(value.toLowerCase()),
      );
      setSuggestions(filtered.slice(0, 8));
    }
    setShowSuggestions(true);
  }

  function handleCategoryFocus() {
    setSuggestions(
      category.trim() === ""
        ? allCategories.slice(0, 8)
        : allCategories.filter((c) =>
            c.toLowerCase().includes(category.toLowerCase()),
          ).slice(0, 8),
    );
    setShowSuggestions(true);
  }

  function selectSuggestion(value: string) {
    setCategory(value);
    setShowSuggestions(false);
    categoryRef.current?.blur();
  }

  function formatAmountDisplay(raw: string) {
    const num = raw.replace(/\D/g, "");
    if (!num) return "";
    return Number(num).toLocaleString("id-ID");
  }

  function handleAmountChange(value: string) {
    const num = value.replace(/\D/g, "");
    setAmount(num);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const numAmount = Number(amount);
    if (!category.trim()) { setError("Kategori wajib diisi"); return; }
    if (!numAmount || numAmount <= 0) { setError("Nominal harus lebih dari 0"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: category.trim(),
          amount: numAmount,
          description: description.trim() || null,
          date,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Gagal menyimpan");
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      panelClassName="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
    >
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Catat Pengeluaran
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error && (
            <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              {error}
            </p>
          )}

          {/* Kategori */}
          <div className="relative">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Kategori
            </label>
            <input
              ref={categoryRef}
              type="text"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              onFocus={handleCategoryFocus}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="cth: Listrik, Gaji, Bensin..."
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-teal-500/20"
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onMouseDown={() => selectSuggestion(s)}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-200 dark:hover:bg-teal-500/10 dark:hover:text-teal-300"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Nominal */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Nominal
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={formatAmountDisplay(amount)}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:ring-teal-500/20"
              />
            </div>
            {amount && Number(amount) > 0 && (
              <p className="mt-1 text-xs text-slate-500">{rupiah(Number(amount))}</p>
            )}
          </div>

          {/* Tanggal */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Tanggal
            </label>
            <DatePicker value={date} onChange={setDate} max={todayLocal} />
          </div>

          {/* Keterangan */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Keterangan <span className="font-normal text-slate-400">(opsional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="cth: Listrik bulan Juni"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-teal-500/20"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </button>
          </div>
        </form>
    </Modal>
  );
}
