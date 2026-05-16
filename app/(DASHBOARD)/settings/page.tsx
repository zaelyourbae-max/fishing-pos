import SettingsForm from "@/components/settings/settings-form";
import { requireOwnerPage } from "@/lib/page-guards";
import { getAllPaymentMethods, getPaymentSettings } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import packageJson from "@/package.json";

export default async function SettingsPage() {
  const session = await requireOwnerPage();
  const [settings, owner, paymentMethods, paymentSettings] = await Promise.all([
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
  ]);

  return (
    <SettingsForm
      settings={settings}
      paymentMethods={paymentMethods}
      paymentSettings={paymentSettings}
      ownerEmail={owner?.email ?? session.email}
      appVersion={packageJson.version}
    />
  );
}
