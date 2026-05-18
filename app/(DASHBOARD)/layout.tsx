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
      className={`min-h-screen w-full max-w-full overflow-x-hidden text-white lg:flex ${shellClass}`}
    >
      <Sidebar role={session.role} />

      <main className="w-full min-w-0 max-w-full flex-1 overflow-x-hidden px-4 pb-24 pt-4 sm:px-6 md:px-8 lg:px-10 lg:pb-4">
        {children}
      </main>
    </div>
  );
}
