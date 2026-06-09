import { Code2, Info } from "lucide-react";
import SettingsForm from "@/components/settings/settings-form";
import StoreAutoOpenCard from "@/components/settings/store-auto-open-card";
import LoyaltyConfigCard from "@/components/settings/loyalty-config-card";
import ArchiveDataCard from "@/components/settings/archive-data-card";
import { requireOwnerPage } from "@/lib/page-guards";
import { getArchivePreview, getArchiveStats } from "@/lib/archive";
import { getLoyaltyConfig } from "@/lib/loyalty-settings";
import { getAllPaymentMethods, getPaymentSettings } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getStoreStatus } from "@/lib/store-status";
import packageJson from "@/package.json";

export default async function SettingsPage() {
  const session = await requireOwnerPage();
  const [
    settings,
    owner,
    paymentMethods,
    paymentSettings,
    storeStatus,
    loyaltyConfig,
    archivePreview,
    archiveStats,
  ] = await Promise.all([
    getSettings(),
    prisma.user.findUnique({
      where: {
        id: session.sub,
      },
      select: {
        email: true,
      },
    }),
    getAllPaymentMethods(),
    getPaymentSettings(),
    getStoreStatus(),
    getLoyaltyConfig(),
    getArchivePreview(),
    getArchiveStats(),
  ]);

  return (
    <div className="space-y-6">
      <SettingsForm
        settings={settings}
        paymentMethods={paymentMethods}
        paymentSettings={paymentSettings}
        ownerEmail={owner?.email ?? session.email}
      />
      <StoreAutoOpenCard
        initialEnabled={storeStatus.autoOpenEnabled}
        initialTime={storeStatus.autoOpenTime}
      />
      <LoyaltyConfigCard
        initialInterval={loyaltyConfig.interval}
        initialMinPurchase={loyaltyConfig.minPurchase}
      />
      <ArchiveDataCard
        initialPreview={{
          thresholdDate: archivePreview.thresholdDate.toISOString(),
          ageYears: archivePreview.ageYears,
          eligibleCount: archivePreview.eligibleCount,
          oldestDate: archivePreview.oldestDate?.toISOString() ?? null,
          newestDate: archivePreview.newestDate?.toISOString() ?? null,
          grossValue: archivePreview.grossValue,
        }}
        initialStats={archiveStats}
      />

      {/* Kredensial developer — selalu di paling bawah halaman. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300">
              <Code2 className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              Developer / Credit
            </h2>
          </div>
          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <p>Developer: Akbar Fahreza</p>
            <p>a.k.a Alexander Van Meijr</p>
            <p>Powered by Meijrverse</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300">
              <Info className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              System Info
            </h2>
          </div>
          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <p>App version: {packageJson.version}</p>
            <p>Stack: Next.js + Prisma + PostgreSQL</p>
          </div>
        </section>
      </div>
    </div>
  );
}
