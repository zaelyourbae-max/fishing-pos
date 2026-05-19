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
      className={`min-h-screen w-full max-w-full overflow-x-hidden bg-[#f6f8fb] text-slate-950 antialiased lg:flex dark:bg-slate-950 dark:text-white ${shellClass}`}
    >
      <Sidebar role={session.role} />

      <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pb-24 pt-4 sm:px-5 md:px-6 lg:px-7 xl:px-8 2xl:px-10 lg:pb-6">
        {children}
      </main>
    </div>
  );
}
