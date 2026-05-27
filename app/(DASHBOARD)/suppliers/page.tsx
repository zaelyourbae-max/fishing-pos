import SupplierManager from "@/components/suppliers/supplier-manager";
import { requireOwnerPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

export default async function SuppliersPage() {
  await requireOwnerPage();

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
        <p className="mt-3 text-slate-400">
          Catat asal barang untuk pembelian stok. Bisa distributor, grosir,
          sales, atau toko kecil.
        </p>
      </div>

      <SupplierManager suppliers={suppliers} />
    </div>
  );
}
