import { formatDateTimeID } from "@/lib/date-format";
import { rupiah } from "@/lib/reports";

export const PROFIT_STATUS_OPTIONS = [
  "Sehat",
  "HPP belum lengkap",
  "Cek HPP retur",
  "Rugi",
  "Margin rendah",
] as const;

export type ProfitStatus = (typeof PROFIT_STATUS_OPTIONS)[number];

type ProfitSourceProduct = {
  productId: number;
  name: string;
  sku: string;
  category: string | null;
  soldQty: number;
  returnQty: number;
  qty: number;
  grossRevenue: number;
  returnRevenue: number;
  revenue: number;
  salesCogs: number;
  returnCogs: number;
  cogs: number;
  profit: number;
  marginPercent: number;
  missingSalesCost: boolean;
  missingReturnCost: boolean;
  sales: {
    invoiceNumber: string;
    createdAt: Date;
    qty: number;
    revenue: number;
    cogs: number;
    profit: number;
    paymentMethod: string;
  }[];
  returns: {
    invoiceNumber: string;
    createdAt: Date;
    qty: number;
    revenue: number;
    cogs: number;
    reason: string;
    paymentMethod: string;
  }[];
};

type ProfitSourceSummary = {
  hasUnitCostSnapshot: boolean;
  grossRevenue: number;
  returnRevenue: number;
  netRevenue: number;
  salesCogs: number;
  returnCogs: number;
  netCogs: number;
  grossProfit: number;
  netProfit: number;
  marginPercent: number;
  hasIncompleteReturnCost: boolean;
  incompleteReturnCostCount: number;
  topProducts: ProfitSourceProduct[];
  productBreakdown: ProfitSourceProduct[];
};

export type SerializedProfitProduct = ReturnType<typeof serializeProfitProduct>;
export type SerializedProfitSummary = ReturnType<typeof serializeProfitSummary>;

export function formatProfitPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDateTime(date: Date) {
  return formatDateTimeID(date);
}

export function profitStatus(item: {
  soldQty: number;
  missingSalesCost: boolean;
  missingReturnCost: boolean;
  profit: number;
  revenue: number;
}): ProfitStatus {
  if (item.soldQty > 0 && item.missingSalesCost) {
    return "HPP belum lengkap";
  }

  if (item.missingReturnCost) {
    return "Cek HPP retur";
  }

  if (item.profit < 0) {
    return "Rugi";
  }

  if (item.revenue > 0 && (item.profit / item.revenue) * 100 < 15) {
    return "Margin rendah";
  }

  return "Sehat";
}

export function formatProfitMargin(value: number | null) {
  return value === null ? "-" : formatProfitPercent(value);
}

export function serializeProfitProduct(item: ProfitSourceProduct) {
  const status = profitStatus(item);
  const marginValid = status !== "HPP belum lengkap";
  const marginValue = marginValid ? item.marginPercent : null;

  return {
    productId: item.productId,
    name: item.name,
    sku: item.sku,
    category: item.category,
    soldQty: item.soldQty,
    returnQty: item.returnQty,
    netQty: item.qty,
    grossRevenue: rupiah(item.grossRevenue),
    returnRevenue: rupiah(item.returnRevenue),
    netRevenue: rupiah(item.revenue),
    salesCogs: rupiah(item.salesCogs),
    returnCogs: rupiah(item.returnCogs),
    netCogs: rupiah(item.cogs),
    revenue: rupiah(item.revenue),
    cogs: rupiah(item.cogs),
    profit: rupiah(item.profit),
    margin: formatProfitMargin(marginValue),
    marginValue,
    status,
    marginValid,
    sales: item.sales.map((sale) => ({
      invoiceNumber: sale.invoiceNumber,
      createdAt: formatDateTime(sale.createdAt),
      qty: sale.qty,
      revenue: rupiah(sale.revenue),
      cogs: rupiah(sale.cogs),
      profit: rupiah(sale.profit),
      margin: formatProfitMargin(
        sale.cogs <= 0 ? null : (sale.profit / Math.max(sale.revenue, 1)) * 100,
      ),
      paymentMethod: sale.paymentMethod,
    })),
    returns: item.returns.map((saleReturn) => ({
      invoiceNumber: saleReturn.invoiceNumber,
      createdAt: formatDateTime(saleReturn.createdAt),
      qty: saleReturn.qty,
      revenue: rupiah(saleReturn.revenue),
      cogs: rupiah(saleReturn.cogs),
      reason: saleReturn.reason,
      paymentMethod: saleReturn.paymentMethod,
    })),
  };
}

export function serializeProfitSummary(profit: ProfitSourceSummary) {
  return {
    hasUnitCostSnapshot: profit.hasUnitCostSnapshot,
    grossRevenue: rupiah(profit.grossRevenue),
    returnRevenue: rupiah(profit.returnRevenue),
    netRevenue: rupiah(profit.netRevenue),
    salesCogs: rupiah(profit.salesCogs),
    returnCogs: rupiah(profit.returnCogs),
    netCogs: rupiah(profit.netCogs),
    grossProfit: rupiah(profit.grossProfit),
    netProfit: rupiah(profit.netProfit),
    margin: formatProfitPercent(profit.marginPercent),
    returnCostWarning: profit.hasIncompleteReturnCost
      ? `${profit.incompleteReturnCostCount} item retur belum memiliki snapshot HPP. HPP retur lama tidak mengurangi HPP sampai data dilengkapi.`
      : null,
    topProducts: profit.topProducts.map(serializeProfitProduct),
    products: profit.productBreakdown.map(serializeProfitProduct),
  };
}
