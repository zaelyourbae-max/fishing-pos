import { Palette } from "lucide-react";

import ChangePasswordCard from "@/components/settings/change-password-card";
import EditProfileCard from "@/components/settings/edit-profile-card";
import PalettePicker from "@/components/settings/palette-picker";
import { requireCashierPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

export default async function CashierAppearancePage() {
  const session = await requireCashierPage();

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true, email: true, phone: true },
  });

  return (
    <div className="space-y-6">
      <EditProfileCard
        initialName={user?.name ?? ""}
        email={user?.email ?? session.email}
        initialPhone={user?.phone ?? ""}
      />

      <ChangePasswordCard />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300">
            <Palette className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              Warna Tampilan
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Pilih palet warna yang nyaman untukmu. Hanya berlaku di perangkat
              ini.
            </p>
          </div>
        </div>
        <PalettePicker />
      </section>
    </div>
  );
}
