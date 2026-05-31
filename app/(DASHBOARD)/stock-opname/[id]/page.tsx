import { notFound, redirect } from "next/navigation";

import StockOpnameDetail from "@/components/stock-opname/stock-opname-detail";
import { requireProtectedPage } from "@/lib/page-guards";
import { canAccessStockOpname, canManageStockOpname } from "@/lib/permissions";
import { getStockOpnameDetail } from "@/lib/stock-opname";

type StockOpnameDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StockOpnameDetailPage({
  params,
}: StockOpnameDetailPageProps) {
  const session = await requireProtectedPage();

  if (!canAccessStockOpname(session.role)) {
    redirect("/cashier");
  }

  const { id } = await params;
  const stockOpname = await getStockOpnameDetail(id);

  if (!stockOpname) {
    notFound();
  }

  return (
    <StockOpnameDetail
      session={{
        id: stockOpname.id,
        opnameNumber: stockOpname.opnameNumber,
        status: stockOpname.status,
        title: stockOpname.title,
        notes: stockOpname.notes,
        snapshotAt: stockOpname.snapshotAt.toISOString(),
        createdAt: stockOpname.createdAt.toISOString(),
        approvedAt: stockOpname.approvedAt?.toISOString() ?? null,
        cancelledAt: stockOpname.cancelledAt?.toISOString() ?? null,
        createdBy: stockOpname.createdBy,
        approvedBy: stockOpname.approvedBy,
        cancelledBy: stockOpname.cancelledBy,
        items: stockOpname.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productSkuSnapshot: item.productSkuSnapshot,
          barcodeSnapshot: item.barcodeSnapshot,
          productNameSnapshot: item.productNameSnapshot,
          categorySnapshot: item.categorySnapshot,
          unitSnapshot: item.unitSnapshot,
          rackLocationSnapshot: item.rackLocationSnapshot,
          systemStock: item.systemStock,
          physicalStock: item.physicalStock,
          difference: item.difference,
          costPriceSnapshot: item.costPriceSnapshot,
          notes: item.notes,
        })),
      }}
      canManage={canManageStockOpname(session.role)}
    />
  );
}
