import { Skeleton } from "@/components/ui/skeleton";

/**
 * Kerangka loading umum untuk semua halaman dashboard.
 * Muncul SEKETIKA saat pindah halaman, jadi terasa responsif walau data
 * masih diambil dari server (tidak lagi membeku di halaman lama).
 * Sidebar tetap diam — hanya area isi yang menampilkan kerangka.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5 sm:space-y-7" aria-busy="true" aria-label="Memuat halaman">
      {/* Judul halaman */}
      <div className="space-y-3">
        <Skeleton className="h-7 w-48 sm:h-9 sm:w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      {/* Baris kartu statistik */}
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Blok konten utama (mis. tabel/daftar) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-64 max-w-full" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-8 w-20 shrink-0 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
