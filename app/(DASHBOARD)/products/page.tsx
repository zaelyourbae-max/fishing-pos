import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  Boxes,
  DollarSign,
  Filter,
  Package,
  Plus,
  Upload,
} from "lucide-react";

import ProductEditButton from "@/components/products/product-edit-button";
import ProductStatusActionButton from "@/components/products/product-status-action-button";
import StockCorrectionButton from "@/components/products/stock-correction-button";
import LiveSearchInput from "@/components/search/live-search-input";
import PaginationLinks from "@/components/ui/pagination-links";
import { canManageProducts, canViewCostPrice } from "@/lib/auth-session";
import { requireProtectedPage } from "@/lib/page-guards";
import {
  getProductAnalyticsWhere,
  parseProductAnalyticsFilter,
  PRODUCT_ANALYTICS_FILTERS,
  PRODUCT_ANALYTICS_FILTER_LABELS,
  type ProductAnalyticsFilter,
} from "@/lib/product-analytics";
import { prisma } from "@/lib/prisma";

type ProductsPageProps = {
  searchParams?: Promise<{
    status?: string;
    q?: string;
    category?: string;
    filter?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 8;

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function marginLabel(price: number, costPrice: number) {
  if (costPrice <= 0) {
    return "-";
  }

  const margin = price - costPrice;
  const percentage = price > 0 ? Math.round((margin / price) * 100) : 0;

  return `${rupiah(margin)} (${percentage}%)`;
}

function compactProductValues(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(" / ");
}

function productIdentityMeta(product: {
  brand: string | null;
  type: string | null;
  size: string | null;
  variant: string | null;
}) {
  return compactProductValues([
    product.brand,
    product.type,
    product.size,
    product.variant,
  ]);
}

function productCategoryLocationMeta(product: {
  category: string | null;
  rackLocation: string | null;
}) {
  return compactProductValues([
    product.category ?? "Tanpa kategori",
    product.rackLocation ? `Rak ${product.rackLocation}` : null,
  ]);
}

function statusHref(
  status: "active" | "inactive" | "all",
  params: {
    q: string;
    category: string;
    filter: string;
  },
) {
  const query = new URLSearchParams();

  if (status !== "active") {
    query.set("status", status);
  }

  if (params.q) {
    query.set("q", params.q);
  }

  if (params.category) {
    query.set("category", params.category);
  }

  if (params.filter) {
    query.set("filter", params.filter);
  }

  const next = query.toString();

  return next ? `/products?${next}` : "/products";
}

function pageHref(
  page: number,
  params: {
    status: string;
    q: string;
    category: string;
    filter: string;
  },
) {
  const query = new URLSearchParams();

  if (params.status !== "active") {
    query.set("status", params.status);
  }

  if (params.q) {
    query.set("q", params.q);
  }

  if (params.category) {
    query.set("category", params.category);
  }

  if (params.filter) {
    query.set("filter", params.filter);
  }

  if (page > 1) {
    query.set("page", String(page));
  }

  const next = query.toString();

  return next ? `/products?${next}` : "/products";
}

function analyticsFilterHref(
  filter: ProductAnalyticsFilter | null,
  params: {
    status: string;
    q: string;
    category: string;
  },
) {
  const query = new URLSearchParams();

  if (params.status !== "active") {
    query.set("status", params.status);
  }

  if (params.q) {
    query.set("q", params.q);
  }

  if (params.category) {
    query.set("category", params.category);
  }

  if (filter) {
    query.set("filter", filter);
  }

  const next = query.toString();

  return next ? `/products?${next}` : "/products";
}

function ProductImage({
  imageUrl,
  name,
  className = "h-12 w-12 rounded-xl",
}: {
  imageUrl: string | null;
  name: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <span
        className={`block shrink-0 border border-slate-200 bg-cover bg-center dark:border-slate-800 ${className}`}
        style={{ backgroundImage: `url("${imageUrl}")` }}
        aria-label={name}
      />
    );
  }

  return (
    <span className={`flex shrink-0 items-center justify-center bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 ${className}`}>
      <Package className="h-5 w-5 sm:h-6 sm:w-6" />
    </span>
  );
}

const statusFilters = [
  {
    label: "Active",
    value: "active",
  },
  {
    label: "Inactive",
    value: "inactive",
  },
  {
    label: "Semua",
    value: "all",
  },
] as const;

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await requireProtectedPage();
  const canManage = canManageProducts(session.role);
  const canViewCost = canViewCostPrice(session.role);

  const params = (await searchParams) ?? {};
  const status =
    canManage && (params.status === "inactive" || params.status === "all")
      ? params.status
      : "active";
  const q = String(params.q ?? "").trim();
  const selectedCategory = String(params.category ?? "").trim();
  const analyticsFilter = parseProductAnalyticsFilter(params.filter);
  const analyticsWhere = getProductAnalyticsWhere(analyticsFilter);
  const currentPage = Math.max(Number(params.page ?? 1) || 1, 1);
  const where: Prisma.ProductWhereInput = {
    ...(status === "all" ? {} : { isActive: status === "active" }),
    ...(selectedCategory ? { category: selectedCategory } : {}),
    ...(analyticsWhere ? { AND: [analyticsWhere] } : {}),
    ...(q
      ? {
          AND: q
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((kw) => ({
              OR: [
                { name: { contains: kw, mode: "insensitive" as const } },
                { sku: { contains: kw, mode: "insensitive" as const } },
                { barcode: { contains: kw, mode: "insensitive" as const } },
                { category: { contains: kw, mode: "insensitive" as const } },
                { brand: { contains: kw, mode: "insensitive" as const } },
                { type: { contains: kw, mode: "insensitive" as const } },
                { size: { contains: kw, mode: "insensitive" as const } },
                { variant: { contains: kw, mode: "insensitive" as const } },
              ],
            })),
        }
      : {}),
  };
  const [products, totalProducts, summaryProducts, categories] =
    await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          supplier: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              purchaseItems: true,
              saleItems: true,
              saleReturnItems: true,
              stockMovements: true,
              supplierReturnItems: true,
            },
          },
        },
      }),
      prisma.product.count({
        where,
      }),
      prisma.product.findMany({
        where,
        select: {
          stock: true,
          price: true,
          costPrice: true,
        },
      }),
      prisma.product.findMany({
        where: {
          category: {
            not: null,
          },
        },
        distinct: ["category"],
        orderBy: {
          category: "asc",
        },
        select: {
          category: true,
        },
      }),
    ]);
  const categoryOptions = categories
    .map((product) => product.category)
    .filter((category): category is string => Boolean(category));
  const totalStock = summaryProducts.reduce((acc, item) => acc + item.stock, 0);
  const totalInventory = summaryProducts.reduce(
    (acc, item) => acc + item.price * item.stock,
    0,
  );
  const totalCostInventory = summaryProducts.reduce(
    (acc, item) => acc + item.costPrice * item.stock,
    0,
  );
  const hasCostPrice = summaryProducts.some((item) => item.costPrice > 0);
  const pageCount = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const safePage = Math.min(currentPage, pageCount);

  return (
    <div className="space-y-3 overflow-x-hidden sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">
            Inventory Produk
          </h1>
          <p className="mobile-section-copy">
            Sistem POS Toko Pancing
          </p>
        </div>

        {canManage ? (
          <div className="grid gap-2 sm:flex-row sm:grid-cols-2 sm:gap-3 lg:flex">
            <Link
              href="/products/import"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:active:bg-slate-900 sm:h-12 sm:rounded-2xl sm:px-5 sm:text-sm"
            >
              <Upload size={18} />
              Import Excel
            </Link>
            <Link
              href="/products/create"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 text-xs font-semibold text-white shadow-sm shadow-teal-600/15 transition-colors duration-200 hover:bg-teal-700 active:bg-teal-700 sm:h-12 sm:rounded-2xl sm:px-5 sm:text-sm"
            >
              <Plus size={18} />
              Tambah Produk
            </Link>
          </div>
        ) : null}
      </div>

      <div className={`grid grid-cols-2 gap-2 sm:gap-4 ${canViewCost ? "xl:grid-cols-4" : "lg:grid-cols-2"}`}>
        <Link
          href="/products?status=all"
          className="mobile-card-surface flex min-h-[86px] items-center gap-2.5 p-2.5 hover:border-teal-200 hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:min-h-32 sm:gap-4 sm:rounded-3xl sm:p-5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-14 sm:w-14 sm:rounded-2xl">
            <Package className="h-5 w-5 sm:h-7 sm:w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Produk
            </span>
            <span className="metric-value mt-0.5 block whitespace-nowrap text-xl sm:mt-1 sm:text-2xl">
              {totalProducts}
            </span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm">
              Produk
            </span>
          </span>
        </Link>

        <Link
          href="/products"
          className="mobile-card-surface flex min-h-[86px] items-center gap-2.5 p-2.5 hover:border-teal-200 hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:min-h-32 sm:gap-4 sm:rounded-3xl sm:p-5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-14 sm:w-14 sm:rounded-2xl">
            <Boxes className="h-5 w-5 sm:h-7 sm:w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Stok
            </span>
            <span className="metric-value mt-0.5 block whitespace-nowrap text-xl sm:mt-1 sm:text-2xl">
              {totalStock}
            </span>
            <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm">
              Unit
            </span>
          </span>
        </Link>

        {canViewCost ? (
          <Link
            href="/reports"
            className="mobile-card-surface flex min-h-[86px] items-center gap-2.5 p-2.5 hover:border-teal-200 hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:min-h-32 sm:gap-4 sm:rounded-3xl sm:p-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-14 sm:w-14 sm:rounded-2xl">
              <DollarSign className="h-5 w-5 sm:h-7 sm:w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
                Nilai Jual Stok
              </span>
            <span className="metric-value mt-0.5 block break-words text-base sm:mt-1 sm:text-2xl">
                {rupiah(totalInventory)}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm">
                Harga jual x stok
              </span>
            </span>
          </Link>
        ) : null}

        {canViewCost ? (
          <div className="mobile-card-surface flex min-h-[86px] items-center gap-2.5 p-2.5 sm:min-h-32 sm:gap-4 sm:rounded-3xl sm:p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:h-14 sm:w-14 sm:rounded-2xl">
              <DollarSign className="h-5 w-5 sm:h-7 sm:w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
                Nilai Modal Stok
              </span>
              <span className="metric-value mt-0.5 block break-words text-base sm:mt-1 sm:text-2xl">
                {rupiah(totalCostInventory)}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:mt-1 sm:text-sm">
                {hasCostPrice ? "HPP x stok" : "HPP belum tersedia"}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <section
        data-search-results
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[28px]"
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 sm:gap-5 sm:p-5">
          <div className="min-w-0">
            <h2 className="mobile-section-heading">
              Daftar Produk
            </h2>
            <p className="mobile-section-copy max-w-2xl">
              Produk active tampil di POS. Produk inactive tersimpan untuk histori.
            </p>
          </div>

          {canManage ? (
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900 sm:gap-2 sm:rounded-2xl">
              {statusFilters.map((filter) => (
                <Link
                  key={filter.value}
                  href={statusHref(filter.value, {
                    q,
                    category: selectedCategory,
                    filter: analyticsFilter ?? "",
                  })}
                  className={
                    status === filter.value
                      ? "inline-flex h-9 items-center justify-center rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-semibold text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20 sm:h-11 sm:rounded-xl sm:px-4 sm:text-sm"
                      : "inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-white hover:text-teal-700 dark:text-slate-300 dark:hover:bg-slate-950 sm:h-11 sm:rounded-xl sm:px-4 sm:text-sm"
                  }
                >
                  {filter.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <form className="grid gap-2.5 border-b border-slate-200 p-3 md:grid-cols-[1fr_270px_auto] dark:border-slate-800 sm:gap-3 sm:p-4">
          {status !== "active" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          {analyticsFilter ? (
            <input type="hidden" name="filter" value={analyticsFilter} />
          ) : null}
          <LiveSearchInput
            initialValue={q}
            placeholder="Cari nama produk, SKU, barcode..."
          />
          <select
            name="category"
            defaultValue={selectedCategory}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10 sm:h-12 sm:rounded-2xl sm:px-4"
          >
            <option value="">Semua kategori/laci</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:border-teal-300 hover:text-teal-700 active:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:active:bg-slate-900 sm:h-12 sm:rounded-2xl sm:px-5"
            type="submit"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </form>

        <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800 sm:px-4">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Filter analitik
            </p>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
              <Link
                href={analyticsFilterHref(null, {
                  status,
                  q,
                  category: selectedCategory,
                })}
                className={
                  analyticsFilter === null
                    ? "inline-flex min-h-9 shrink-0 items-center rounded-full border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20"
                    : "inline-flex min-h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-teal-200 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-teal-200"
                }
              >
                Semua
              </Link>
              {PRODUCT_ANALYTICS_FILTERS.map((filter) => (
                <Link
                  key={filter}
                  href={analyticsFilterHref(filter, {
                    status,
                    q,
                    category: selectedCategory,
                  })}
                  className={
                    analyticsFilter === filter
                      ? "inline-flex min-h-9 shrink-0 items-center rounded-full border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20"
                      : "inline-flex min-h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-teal-200 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-teal-200"
                  }
                >
                  {PRODUCT_ANALYTICS_FILTER_LABELS[filter]}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden lg:block">
          <table className="w-full table-fixed text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <tr>
                <th className="w-[21%] px-4 py-3">Nama Produk</th>
                <th className="w-[16%] px-4 py-3">SKU / Kategori</th>
                <th className="w-[10%] px-4 py-3 text-right">Harga Jual</th>
                {canViewCost ? (
                  <>
                    <th className="w-[11%] px-4 py-3 text-right">HPP</th>
                    <th className="w-[11%] px-4 py-3 text-right">Margin</th>
                  </>
                ) : null}
                <th className="w-[10%] px-4 py-3 text-right">Stok</th>
                <th className="w-[7%] px-4 py-3">Status</th>
                {canManage ? (
                  <th className="w-[14%] px-4 py-3 text-right">Aksi</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {products.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={(canManage ? 6 : 5) + (canViewCost ? 2 : 0)}>
                    Tidak ada produk pada filter ini.
                  </td>
                </tr>
              ) : null}
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="text-sm transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductImage imageUrl={product.imageUrl} name={product.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                          {product.name}
                        </p>
                        {productIdentityMeta(product) ? (
                          <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                            {productIdentityMeta(product)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {product.sku ?? product.barcode ?? "-"}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                      {productCategoryLocationMeta(product)}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-950 dark:text-white">
                      {rupiah(product.price)}
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                      / {product.unit}
                    </p>
                  </td>
                  {canViewCost ? (
                    <>
                      <td className="px-4 py-3 text-right">
                        {product.costPrice > 0 ? (
                          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                            {rupiah(product.costPrice)}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-200">
                            Belum lengkap
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={
                            product.costPrice > 0 && product.price - product.costPrice >= 0
                              ? "whitespace-nowrap text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-300"
                              : "whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400"
                          }
                        >
                          {marginLabel(product.price, product.costPrice)}
                        </span>
                      </td>
                    </>
                  ) : null}
                  <td className="px-4 py-3 text-right">
                    <div className="min-w-[78px]">
                      <p
                        className={
                          product.stock <= product.minStock
                            ? "whitespace-nowrap text-sm font-bold tabular-nums text-amber-700 dark:text-amber-200"
                            : "whitespace-nowrap text-sm font-bold tabular-nums text-slate-950 dark:text-white"
                        }
                      >
                        {product.stock} {product.unit}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">
                        Min {product.minStock}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <span
                        className={
                          product.isActive
                            ? "h-2 w-2 rounded-full bg-emerald-500"
                            : "h-2 w-2 rounded-full bg-slate-400"
                        }
                      />
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <ProductEditButton
                          product={{
                            id: product.id,
                            sku: product.sku,
                            barcode: product.barcode,
                            name: product.name,
                            brand: product.brand,
                            type: product.type,
                            size: product.size,
                            variant: product.variant,
                            price: product.price,
                            costPrice: product.costPrice,
                            stock: product.stock,
                            minStock: product.minStock,
                            unit: product.unit,
                            category: product.category,
                            supplierName: product.supplier?.name ?? null,
                            rackLocation: product.rackLocation,
                            description: product.description,
                            imageUrl: product.imageUrl,
                            hasStockHistory:
                              product._count.purchaseItems > 0 ||
                              product._count.saleItems > 0 ||
                              product._count.saleReturnItems > 0 ||
                              product._count.stockMovements > 0 ||
                              product._count.supplierReturnItems > 0,
                          }}
                          categories={categoryOptions}
                        />
                        <ProductStatusActionButton
                          productId={product.id}
                          productName={product.name}
                          isActive={product.isActive}
                          compact
                        />
                        <StockCorrectionButton
                          product={{
                            id: product.id,
                            name: product.name,
                            sku: product.sku,
                            category: product.category,
                            stock: product.stock,
                          }}
                          compact
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 bg-slate-50/70 p-2 sm:space-y-3 sm:p-4 lg:hidden dark:bg-slate-900/30">
          {products.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              Tidak ada produk pada filter ini.
            </div>
          ) : null}
          {products.map((product) => (
            <div
              key={product.id}
              className="mobile-card-surface p-2.5 active:bg-slate-50 dark:active:bg-slate-900 sm:rounded-2xl sm:p-4"
            >
              <div className="flex min-w-0 items-start gap-2.5 sm:gap-4">
                <ProductImage
                  imageUrl={product.imageUrl}
                  name={product.name}
                  className="h-9 w-9 rounded-lg sm:h-12 sm:w-12 sm:rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 break-words text-sm font-bold leading-snug text-slate-950 dark:text-white sm:line-clamp-2">
                        {product.name}
                      </p>
                      {productIdentityMeta(product) ? (
                        <p className="mt-0.5 line-clamp-1 break-words text-[11px] font-semibold text-slate-500 dark:text-slate-400 sm:text-xs">
                          {productIdentityMeta(product)}
                        </p>
                      ) : null}
                      <p className="mt-0.5 line-clamp-1 break-words text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                        {product.sku ?? product.barcode ?? "-"} -{" "}
                        {productCategoryLocationMeta(product)}
                      </p>
                    </div>
                    <span className="shrink-0 text-right text-sm font-extrabold tabular-nums text-slate-950 dark:text-white sm:whitespace-nowrap">
                      {rupiah(product.price)}
                      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                        / {product.unit}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 text-[11px] sm:mt-3 sm:gap-2 sm:text-xs">
                    <div className="mobile-mini-stat sm:rounded-xl sm:px-3 sm:py-2">
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        Stok
                      </p>
                      <p
                        className={
                          product.stock <= product.minStock
                            ? "mt-0.5 font-bold tabular-nums text-amber-700 dark:text-amber-200"
                            : "mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-100"
                        }
                      >
                        {product.stock} {product.unit}
                      </p>
                    </div>
                    <div className="mobile-mini-stat sm:rounded-xl sm:px-3 sm:py-2">
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        Min
                      </p>
                      <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {product.minStock}
                      </p>
                    </div>
                    <div className="mobile-mini-stat sm:rounded-xl sm:px-3 sm:py-2">
                      <p className="font-medium text-slate-500 dark:text-slate-400">
                        Status
                      </p>
                      <p
                        className={
                          product.isActive
                            ? "mt-0.5 font-bold text-emerald-700 dark:text-emerald-300"
                            : "mt-0.5 font-bold text-slate-600 dark:text-slate-300"
                        }
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </p>
                    </div>
                    {canViewCost ? (
                      <div className="col-span-3 grid grid-cols-2 gap-1.5 sm:gap-2">
                        <span className="mobile-mini-stat font-bold tabular-nums text-slate-600 dark:text-slate-300 sm:rounded-xl sm:px-3 sm:py-2">
                          HPP{" "}
                          {product.costPrice > 0
                            ? rupiah(product.costPrice)
                            : "belum lengkap"}
                        </span>
                        <span className="mobile-mini-stat font-bold tabular-nums text-emerald-700 dark:text-emerald-300 sm:rounded-xl sm:px-3 sm:py-2">
                          Margin {marginLabel(product.price, product.costPrice)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {canManage ? (
                <div className="mt-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800 sm:mt-3 sm:pt-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Aksi Produk
                    </p>
                    <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      Edit data berbeda dari koreksi stok
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
                    <ProductEditButton
                      product={{
                        id: product.id,
                        sku: product.sku,
                        barcode: product.barcode,
                        name: product.name,
                        brand: product.brand,
                        type: product.type,
                        size: product.size,
                        variant: product.variant,
                        price: product.price,
                        costPrice: product.costPrice,
                        stock: product.stock,
                        minStock: product.minStock,
                        unit: product.unit,
                        category: product.category,
                        supplierName: product.supplier?.name ?? null,
                        rackLocation: product.rackLocation,
                        description: product.description,
                        imageUrl: product.imageUrl,
                        hasStockHistory:
                          product._count.purchaseItems > 0 ||
                          product._count.saleItems > 0 ||
                          product._count.saleReturnItems > 0 ||
                          product._count.stockMovements > 0 ||
                          product._count.supplierReturnItems > 0,
                      }}
                      categories={categoryOptions}
                    />
                    <StockCorrectionButton
                      product={{
                        id: product.id,
                        name: product.name,
                        sku: product.sku,
                        category: product.category,
                        stock: product.stock,
                      }}
                    />
                    <div className="col-span-2 sm:col-span-1">
                      <ProductStatusActionButton
                        productId={product.id}
                        productName={product.name}
                        isActive={product.isActive}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <PaginationLinks
          currentPage={safePage}
          totalItems={totalProducts}
          pageSize={PAGE_SIZE}
          hrefForPage={(page) =>
            pageHref(page, {
              status,
              q,
              category: selectedCategory,
              filter: analyticsFilter ?? "",
            })
          }
        />
      </section>
    </div>
  );
}
