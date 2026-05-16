import PosApp from "@/components/pos/pos-app";
import { getActivePaymentMethods, getPaymentSettings } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { requirePosPage } from "@/lib/page-guards";

export default async function PosPage() {
  const session = await requirePosPage();
  const [user, paymentMethods, paymentSettings] = await Promise.all([
    prisma.user.findUnique({
      where: {
        id: session.sub,
      },
      select: {
        name: true,
        email: true,
        role: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    }),
    getActivePaymentMethods(),
    getPaymentSettings(),
  ]);

  return (
    <PosApp
      currentUser={{
        name: user?.name ?? session.email,
        email: user?.email ?? session.email,
        role: user?.role ?? null,
      }}
      paymentMethods={paymentMethods.map((method) => ({
        code: method.code,
        name: method.name,
        type: method.type,
      }))}
      paymentSettings={paymentSettings}
    />
  );
}
