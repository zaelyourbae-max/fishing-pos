"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type ClientPaginationControlProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  className?: string;
};

function visiblePages(currentPage: number, pageCount: number) {
  const maxVisible = 5;

  if (pageCount <= maxVisible) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, pageCount - maxVisible + 1));

  return Array.from({ length: maxVisible }, (_, index) => start + index);
}

export default function ClientPaginationControl({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  itemLabel = "data",
  className = "",
}: ClientPaginationControlProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), pageCount);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <div
      className={`flex flex-col gap-4 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950 ${className}`}
    >
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        Menampilkan {totalItems === 0 ? "0" : `${from} - ${to}`} dari{" "}
        {totalItems} {itemLabel}
      </p>
      <div className="flex max-w-full flex-wrap items-center gap-2 sm:justify-end">
        <button
          type="button"
          disabled={safePage === 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {visiblePages(safePage, pageCount).map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold ${
              pageNumber === safePage
                ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          disabled={safePage === pageCount}
          onClick={() => onPageChange(Math.min(pageCount, safePage + 1))}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
