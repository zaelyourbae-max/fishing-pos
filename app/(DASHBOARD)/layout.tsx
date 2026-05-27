import Sidebar from "@/components/layout/sidebar";
import { requireProtectedPage } from "@/lib/page-guards";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireProtectedPage();

  const shellClass =
    session.role === "cashier" ? "cashier-shell" : "owner-shell";

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-clip bg-[#f6f8fb] text-slate-950 antialiased lg:flex dark:bg-slate-950 dark:text-white ${shellClass}`}
    >
      <Sidebar role={session.role} />

      <main className="w-full min-w-0 max-w-full flex-1 overflow-x-clip px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2.5 transition-[padding] duration-200 sm:px-4 sm:pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:pt-3 md:px-6 md:pt-4 lg:px-7 lg:pb-6 xl:px-8 2xl:px-10">
        {children}
      </main>
    </div>
  );
}
