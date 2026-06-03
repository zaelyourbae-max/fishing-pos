"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Receipt } from "lucide-react";
import { rupiah } from "@/lib/reports";
import ExpenseForm from "./expense-form";

type ExpenseRow = {
  id: string;
  expenseNumber: string;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  createdByName: string;
};

type Props = {
  expenses: ExpenseRow[];
  totalAmount: number;
  totalCount: number;
};

export default function ExpenseListClient({ expenses, totalAmount, totalCount }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Hapus pengeluaran ini?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <ExpenseForm open={showForm} onClose={() => setShowForm(false)} />

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          <span className="font-bold text-slate-700 dark:text-slate-200">{totalCount}</span>{" "}
          catatan •{" "}
          <span className="font-bold text-rose-600 dark:text-rose-400">
            {rupiah(totalAmount)}
          </span>
        </p>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_-6px_rgba(13,148,136,0.55)] transition hover:-translate-y-0.5 hover:bg-teal-700 hover:shadow-[0_12px_24px_-6px_rgba(13,148,136,0.65)] active:translate-y-0 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Catat Pengeluaran
        </button>
      </div>

      {/* Empty state */}
      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 py-20 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 shadow-[0_8px_18px_-6px_rgba(244,63,94,0.45)] dark:bg-rose-500/10">
            <Receipt className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Belum ada pengeluaran pada periode ini
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Klik "Catat Pengeluaran" untuk mulai mencatat
          </p>
        </div>
      ) : (
        /* Tabel */
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-800">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Tanggal
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Kategori
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 sm:table-cell">
                  Keterangan
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 md:table-cell">
                  Dicatat oleh
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Nominal
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="group transition hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                >
                  <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {expense.date}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                      {expense.category}
                    </span>
                  </td>
                  <td className="hidden max-w-[200px] truncate px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 sm:table-cell">
                    {expense.description ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 dark:text-slate-400 md:table-cell">
                    {expense.createdByName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-extrabold tabular-nums text-rose-600 dark:text-rose-400">
                    {rupiah(expense.amount)}
                  </td>
                  <td className="px-3 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40 dark:text-slate-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
                <td colSpan={4} className="hidden px-4 py-3 text-xs font-semibold text-slate-500 sm:table-cell">
                  Total {totalCount} catatan
                </td>
                <td colSpan={2} className="table-cell px-4 py-3 sm:hidden" />
                <td className="px-4 py-3 text-right text-sm font-extrabold tabular-nums text-rose-700 dark:text-rose-400">
                  {rupiah(totalAmount)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
