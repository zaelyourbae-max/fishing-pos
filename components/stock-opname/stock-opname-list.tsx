"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import StockOpnameStatusBadge from "@/components/stock-opname/stock-opname-status-badge";
import PaginationLinks from "@/components/ui/pagination-links";

type StockOpnameListItem = {
  id: string;
  opnameNumber: string;
  status: "DRAFT" | "COUNTING" | "REVIEW" | "APPROVED" | "CANCELLED";
  title: string | null;
  notes: string | null;
  createdAt: string;
  approvedAt: string | null;
  totalItems: number;
  countedItems: number;
  remainingItems: number;
  totalDifference: number;
  createdBy: {
    name: string;
  };
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function StockOpnameList({
  sessions,
  canManage,
}: {
  sessions: StockOpnameListItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const requestedPage = Math.max(Number(searchParams.get("page") ?? 1) || 1, 1);
  const currentPage = Math.min(requestedPage, totalPages);
  const pagedSessions = sessions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function hrefForPage(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (targetPage > 1) {
      params.set("page", String(targetPage));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  async function createSession() {
    setLoading(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/stock-opnames", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        notes,
      }),
    });
    const payload = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(payload.message ?? "Gagal membuat sesi Stock Opname.");
      return;
    }

    setTitle("");
    setNotes("");
    setMessage("Sesi Stock Opname berhasil dibuat.");
    router.push(`/stock-opname/${payload.data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="page-title">Stock Opname</h1>
        </div>
      </div>

      {canManage ? (
        <section className="surface-panel rounded-3xl p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Judul sesi
              </label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Contoh: SO Mei 2026"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                Catatan
              </label>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opsional"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={createSession}
              disabled={loading}
              className="rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Membuat..." : "Buat Sesi SO"}
            </button>
          </div>
          {message ? (
            <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-300">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm font-medium text-rose-600 dark:text-rose-300">
              {error}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="surface-panel overflow-hidden rounded-3xl">
        <div className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Daftar Sesi
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
            Belum ada sesi Stock Opname.
          </div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3">Sesi</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Progress</th>
                    <th className="px-5 py-3">Selisih</th>
                    <th className="px-5 py-3">Dibuat</th>
                    <th className="px-5 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {pagedSessions.map((session) => (
                    <tr key={session.id}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {session.title || session.opnameNumber}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {session.opnameNumber}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <StockOpnameStatusBadge status={session.status} />
                      </td>
                      <td className="px-5 py-4 text-slate-700 dark:text-slate-200">
                        {session.countedItems}/{session.totalItems} item
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                        {session.totalDifference}
                      </td>
                      <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                        {formatDate(session.createdAt)}
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/stock-opname/${session.id}`}
                          className="inline-flex rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Buka
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list — hidden on sm+ */}
            <div className="divide-y divide-slate-200 sm:hidden dark:divide-slate-800">
              {pagedSessions.map((session) => (
                <Link
                  key={session.id}
                  href={`/stock-opname/${session.id}`}
                  className="block p-4 transition-colors hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 dark:active:bg-slate-900"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                        {session.title || session.opnameNumber}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                        {session.opnameNumber}
                      </p>
                    </div>
                    <StockOpnameStatusBadge status={session.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-baseline gap-2">
                        <span className="w-16 shrink-0 text-xs text-slate-500 dark:text-slate-400">Progress</span>
                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {session.countedItems}/{session.totalItems} item
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="w-16 shrink-0 text-xs text-slate-500 dark:text-slate-400">Dibuat</span>
                        <span className="truncate text-slate-600 dark:text-slate-300">
                          {formatDate(session.createdAt)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-xs text-slate-500 dark:text-slate-400">Selisih</span>
                      <span className="block text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {session.totalDifference}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 ? (
              <PaginationLinks
                currentPage={currentPage}
                totalItems={sessions.length}
                pageSize={PAGE_SIZE}
                hrefForPage={hrefForPage}
                itemLabel="sesi"
              />
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
