import Sidebar from "@/components/layout/sidebar";
import StoreStatusBanner from "@/components/layout/store-status-banner";
import { isOwnerRole } from "@/lib/permissions";
import { requireProtectedPage } from "@/lib/page-guards";
import { getStoreStatus } from "@/lib/store-status";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireProtectedPage();
  const storeStatus = await getStoreStatus();

  const shellClass =
    session.role === "cashier" ? "cashier-shell" : "owner-shell";
  const showOwnerClosedBanner =
    !storeStatus.isOpen && isOwnerRole(session.role);

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-clip bg-background text-slate-950 antialiased lg:flex dark:text-white ${shellClass}`}
    >
      <Sidebar role={session.role} storeOpen={storeStatus.isOpen} />

      <main className="w-full min-w-0 max-w-full flex-1 overflow-x-clip px-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2.5 transition-[padding] duration-200 sm:px-4 sm:pb-[calc(5.75rem+env(safe-area-inset-bottom))] sm:pt-3 md:px-6 md:pt-4 lg:px-7 lg:pb-6 xl:px-8 2xl:px-10">
        {showOwnerClosedBanner ? (
          <StoreStatusBanner closedAt={storeStatus.closedAt} />
        ) : null}
        {children}
      </main>
    </div>
  );
}
