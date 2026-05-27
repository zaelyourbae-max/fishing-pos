import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationLinksProps = {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
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

export default function PaginationLinks({
  currentPage,
  totalItems,
  pageSize,
  hrefForPage,
  itemLabel = "data",
  className = "",
}: PaginationLinksProps) {
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), pageCount);
  const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, totalItems);

  return (
    <div
      className={`flex flex-col gap-2.5 border-t border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5 sm:py-4 dark:border-slate-800 dark:bg-slate-950 ${className}`}
    >
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
        Menampilkan {totalItems === 0 ? "0" : `${from} - ${to}`} dari{" "}
        {totalItems} {itemLabel}
      </p>
      <div className="flex max-w-full flex-wrap items-center gap-1.5 sm:justify-end sm:gap-2">
        <Link
          aria-disabled={safePage === 1}
          href={hrefForPage(Math.max(1, safePage - 1))}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-200 hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:active:bg-slate-900 ${
            safePage === 1 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {visiblePages(safePage, pageCount).map((pageNumber) => (
          <Link
            key={pageNumber}
            href={hrefForPage(pageNumber)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-xs font-semibold transition-colors duration-200 sm:h-10 sm:w-10 sm:rounded-xl sm:text-sm ${
              pageNumber === safePage
                ? "border-teal-200 bg-teal-50 text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20"
                : "border-slate-200 bg-white text-slate-600 shadow-sm hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:active:bg-slate-900"
            }`}
          >
            {pageNumber}
          </Link>
        ))}
        <Link
          aria-disabled={safePage === pageCount}
          href={hrefForPage(Math.min(pageCount, safePage + 1))}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-200 hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 sm:h-10 sm:w-10 sm:rounded-xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:active:bg-slate-900 ${
            safePage === pageCount ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
