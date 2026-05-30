import { redirect } from "next/navigation";

import StockOpnameList from "@/components/stock-opname/stock-opname-list";
import { requireProtectedPage } from "@/lib/page-guards";
import { canAccessStockOpname, canManageStockOpname } from "@/lib/permissions";
import { getStockOpnameList } from "@/lib/stock-opname";

export default async function StockOpnamePage() {
  const session = await requireProtectedPage();

  if (!canAccessStockOpname(session.role)) {
    redirect("/cashier");
  }

  const sessions = await getStockOpnameList();
  const rows = sessions.map((item) => {
    const countedItems = item.items.filter(
      (stockItem) => stockItem.physicalStock !== null,
    ).length;
    const totalDifference = item.items.reduce(
      (sum, stockItem) => sum + (stockItem.difference ?? 0),
      0,
    );

    return {
      id: item.id,
      opnameNumber: item.opnameNumber,
      status: item.status,
      title: item.title,
      notes: item.notes,
      createdAt: item.createdAt.toISOString(),
      approvedAt: item.approvedAt?.toISOString() ?? null,
      totalItems: item._count.items,
      countedItems,
      remainingItems: item._count.items - countedItems,
      totalDifference,
      createdBy: item.createdBy,
    };
  });

  return (
    <StockOpnameList
      sessions={rows}
      canManage={canManageStockOpname(session.role)}
    />
  );
}
