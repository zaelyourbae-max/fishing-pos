import SupplierManager from "@/components/suppliers/supplier-manager";
import { requireOwnerStoreOpenPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

export default async function SuppliersPage() {
  await requireOwnerStoreOpenPage();

  const suppliers = await prisma.supplier.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      phone: true,
      address: true,
      notes: true,
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Supplier</h1>

      </div>

      <SupplierManager suppliers={suppliers} />
    </div>
  );
}
