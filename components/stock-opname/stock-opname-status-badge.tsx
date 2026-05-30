type StockOpnameStatus = "DRAFT" | "COUNTING" | "REVIEW" | "APPROVED" | "CANCELLED";

const statusClass: Record<StockOpnameStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  COUNTING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200",
  REVIEW: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200",
};

export default function StockOpnameStatusBadge({
  status,
}: {
  status: StockOpnameStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass[status]}`}
    >
      {status}
    </span>
  );
}
