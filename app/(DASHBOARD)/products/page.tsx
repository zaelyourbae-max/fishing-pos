import Link from "next/link";
import { Prisma } from "@prisma/client";
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronRight,
  DollarSign,
  Minus,
  Package,
  Plus,
  Upload,
} from "lucide-react";

import ProductActionsMenu from "@/components/products/product-actions-menu";
import ProductEditButton from "@/components/products/product-edit-button";
import ProductFilterForm from "@/components/products/product-filter-form";
import ProductStatusActionButton from "@/components/products/product-status-action-button";
import ProductStatusToggle from "@/components/products/product-status-toggle";
import StockCorrectionButton from "@/components/products/stock-correction-button";
import PaginationLinks from "@/components/ui/pagination-links";
import { canManageProducts, canViewCostPrice } from "@/lib/auth-session";
import { requireStoreOpenPage } from "@/lib/page-guards";
import {
  getProductAnalyticsWhere,
  getProductVelocity,
  parseProductAnalyticsFilter,
  parseSalesVelocityFilter,
  PRODUCT_ANALYTICS_FILTER_LABELS,
  rankFastMoving,
  SALES_VELOCITY_FILTER_LABELS,
  SALES_VELOCITY_FILTERS,
  SALES_VELOCITY_WINDOW_DAYS,
  type ProductVelocity,
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
  variant: string | null;
}) {
  return compactProductValues([
    product.brand,
    product.variant,
  ]);
}

function productCategoryLocationMeta(product: {
  category: string | null;
}) {
  return compactProductValues([
    product.category ?? "Tanpa kategori",
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
  filter: string | null,
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
  name,
  className = "h-12 w-12 rounded-xl",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-label={name}
      className={`flex shrink-0 items-center justify-center bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300 ${className}`}
    >
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

// Urutan chip = tangga perputaran (Fast -> Slow -> Dead), lalu Stok Rendah
// yang merupakan sumbu berbeda (level stok, bukan kecepatan jual).
const filterChips: { value: string; label: string }[] = [
  ...SALES_VELOCITY_FILTERS.map((value) => ({
    value,
    label: SALES_VELOCITY_FILTER_LABELS[value],
  })),
  { value: "slow-moving", label: PRODUCT_ANALYTICS_FILTER_LABELS["slow-moving"] },
  { value: "dead-stock", label: PRODUCT_ANALYTICS_FILTER_LABELS["dead-stock"] },
  { value: "low-stock", label: PRODUCT_ANALYTICS_FILTER_LABELS["low-stock"] },
];

const trendMeta: Record<
  ProductVelocity["trend"],
  { Icon: typeof ArrowUp; className: string; label: string }
> = {
  up: { Icon: ArrowUp, className: "text-emerald-600 dark:text-emerald-400", label: "Naik" },
  new: { Icon: ArrowUp, className: "text-emerald-600 dark:text-emerald-400", label: "Baru" },
  down: { Icon: ArrowDown, className: "text-red-600 dark:text-red-400", label: "Turun" },
  flat: { Icon: Minus, className: "text-slate-400 dark:text-slate-500", label: "Stabil" },
};

function VelocityBadge({ velocity }: { velocity: ProductVelocity | undefined }) {
  if (!velocity) {
    return null;
  }

  const meta = trendMeta[velocity.trend];
  const { Icon } = meta;

  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
      <Icon className={`h-3 w-3 ${meta.className}`} aria-label={meta.label} />
      Laku {velocity.recentQty} unit
      <span className="font-medium text-teal-700/70 dark:text-teal-200/60">
        ({SALES_VELOCITY_WINDOW_DAYS} hari)
      </span>
    </span>
  );
}

// Varian "sambungan di atas kartu" untuk tampilan HP/tablet: strip tipis yang
// menyatu di tepi atas kartu (full-bleed via margin negatif), teks rata tengah,
// supaya info perputaran tidak memakan ruang di blok judul.
function VelocityStrip({ velocity }: { velocity: ProductVelocity | undefined }) {
  if (!velocity) {
    return null;
  }

  const meta = trendMeta[velocity.trend];
  const { Icon } = meta;

  return (
    <div className="-mx-2.5 -mt-2.5 mb-2.5 flex items-center justify-center gap-1.5 rounded-t-xl border-b border-teal-100 bg-teal-50 px-3 py-1.5 text-[11px] font-bold text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-200 sm:-mx-4 sm:-mt-4 sm:mb-3 sm:rounded-t-2xl">
      <Icon className={`h-3 w-3 ${meta.className}`} aria-label={meta.label} />
      Laku {velocity.recentQty} unit
      <span className="font-medium text-teal-700/70 dark:text-teal-200/60">
        · {SALES_VELOCITY_WINDOW_DAYS} hari
      </span>
    </div>
  );
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await requireStoreOpenPage();
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
  const velocityFilter = parseSalesVelocityFilter(params.filter);
  const activeFilter = velocityFilter ?? analyticsFilter;
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

  const productInclude = {
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
  } satisfies Prisma.ProductInclude;
  type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

  const categoriesQuery = prisma.product.findMany({
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
  });

  let products: ProductRow[];
  let totalProducts: number;
  let summaryProducts: { stock: number; price: number; costPrice: number }[];
  let categories: { category: string | null }[];
  // Diisi hanya pada filter "Paling Laku"/"Melambat" untuk menampilkan badge
  // jumlah terjual + tren naik/turun per produk.
  let velocityById: Map<number, ProductVelocity> | null = null;

  if (velocityFilter) {
    const velocity = await getProductVelocity();
    const ranked = rankFastMoving(velocity);
    velocityById = new Map(ranked.map((item) => [item.productId, item]));

    // Ranking dibuat dari data penjualan; di sini disaring agar tunduk pada
    // status/kategori/pencarian.
    const candidateIds = ranked.map((item) => item.productId);
    const matchWhere: Prisma.ProductWhereInput = {
      ...where,
      id: { in: candidateIds.length ? candidateIds : [-1] },
    };
    const matchedRows = await prisma.product.findMany({
      where: matchWhere,
      select: { id: true },
    });
    const matchedSet = new Set(matchedRows.map((row) => row.id));
    const orderedIds = candidateIds.filter((id) => matchedSet.has(id));

    totalProducts = orderedIds.length;
    const pageIds = orderedIds.slice(
      (currentPage - 1) * PAGE_SIZE,
      (currentPage - 1) * PAGE_SIZE + PAGE_SIZE,
    );

    const [pageRows, summaryRows, categoryRows] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: pageIds.length ? pageIds : [-1] } },
        include: productInclude,
      }),
      prisma.product.findMany({
        where: { id: { in: orderedIds.length ? orderedIds : [-1] } },
        select: { stock: true, price: true, costPrice: true },
      }),
      categoriesQuery,
    ]);

    // Prisma tak bisa mengurutkan sesuai posisi array id, jadi kembalikan
    // urutan ranking secara manual.
    const rowById = new Map(pageRows.map((row) => [row.id, row]));
    products = pageIds
      .map((id) => rowById.get(id))
      .filter((row): row is ProductRow => Boolean(row));
    summaryProducts = summaryRows;
    categories = categoryRows;
  } else {
    [products, totalProducts, summaryProducts, categories] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: productInclude,
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
      categoriesQuery,
    ]);
  }
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
        </div>

        {canManage ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3 lg:flex">
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

      {/* KPI card: pola laporan owner (MetricCard) — baris atas ikon+judul,
          angka membentang penuh di bawah, keterangan berwarna. Layout vertikal
          ini ramah mobile karena angka panjang (Rp ...) dapat lebar penuh. */}
      <div className={`grid grid-cols-2 gap-2 sm:gap-4 ${canViewCost ? "xl:grid-cols-4" : "lg:grid-cols-2"}`}>
        <Link
          href="/products?status=all"
          className="mobile-card-surface block p-3 text-left transition-colors hover:border-teal-200 hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:rounded-3xl sm:p-5"
        >
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200 sm:h-12 sm:w-12">
              <Package className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] font-bold leading-tight text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Produk
            </p>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500 sm:h-6 sm:w-6" />
          </div>
          <p className="metric-value mt-2 block break-words text-xl font-extrabold leading-snug tracking-tight tabular-nums sm:mt-3 sm:text-2xl">
            {totalProducts}
          </p>
          <p className="mt-1.5 break-words text-[13px] font-semibold leading-snug text-teal-700 dark:text-teal-300 sm:text-sm">
            Lihat semua
          </p>
        </Link>

        <div className="mobile-card-surface p-3 text-left sm:rounded-3xl sm:p-5">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200 sm:h-12 sm:w-12">
              <Boxes className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <p className="min-w-0 flex-1 text-[13px] font-bold leading-tight text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Stok
            </p>
          </div>
          <p className="metric-value mt-2 block break-words text-xl font-extrabold leading-snug tracking-tight tabular-nums sm:mt-3 sm:text-2xl">
            {totalStock}
          </p>
          <p className="mt-1.5 break-words text-[13px] font-semibold leading-snug text-slate-500 dark:text-slate-400 sm:text-sm">
            Unit
          </p>
        </div>

        {canViewCost ? (
          <div className="mobile-card-surface p-3 text-left sm:rounded-3xl sm:p-5">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 sm:h-12 sm:w-12">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <p className="min-w-0 flex-1 text-[13px] font-bold leading-tight text-slate-500 dark:text-slate-400 sm:text-sm">
                Nilai Jual Stok
              </p>
            </div>
            <p className="metric-value mt-2 block break-words text-xl font-extrabold leading-snug tracking-tight tabular-nums sm:mt-3 sm:text-2xl">
              {rupiah(totalInventory)}
            </p>
            <p className="mt-1.5 break-words text-[13px] font-semibold leading-snug text-emerald-700 dark:text-emerald-300 sm:text-sm">
              Bila semua stok terjual
            </p>
          </div>
        ) : null}

        {canViewCost ? (
          <div className="mobile-card-surface p-3 text-left sm:rounded-3xl sm:p-5">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:h-12 sm:w-12">
                <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
              <p className="min-w-0 flex-1 text-[13px] font-bold leading-tight text-slate-500 dark:text-slate-400 sm:text-sm">
                Nilai Modal Stok
              </p>
            </div>
            <p className="metric-value mt-2 block break-words text-xl font-extrabold leading-snug tracking-tight tabular-nums sm:mt-3 sm:text-2xl">
              {rupiah(totalCostInventory)}
            </p>
            <p className="mt-1.5 break-words text-[13px] font-semibold leading-snug text-amber-700 dark:text-amber-300 sm:text-sm">
              {hasCostPrice ? "Modal beli semua stok" : "Modal belum lengkap"}
            </p>
          </div>
        ) : null}
      </div>

      <section
        data-search-results
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:rounded-[28px]"
      >
        {canManage ? (
          <div className="flex flex-col gap-3 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-end dark:border-slate-800 sm:gap-5 sm:p-5">
            <ProductStatusToggle
              active={status}
              options={statusFilters.map((filter) => ({
                label: filter.label,
                value: filter.value,
                href: statusHref(filter.value, {
                  q,
                  category: selectedCategory,
                  filter: activeFilter ?? "",
                }),
              }))}
            />
          </div>
        ) : null}

        <ProductFilterForm
          initialQ={q}
          initialCategory={selectedCategory}
          categoryOptions={categoryOptions}
        />

        <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800 sm:px-4">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Filter analitik
            </p>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-end sm:overflow-visible sm:pb-0">
              <Link
                href={analyticsFilterHref(null, {
                  status,
                  q,
                  category: selectedCategory,
                })}
                scroll={false}
                className={
                  activeFilter === null
                    ? "inline-flex min-h-9 shrink-0 items-center rounded-full border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20"
                    : "inline-flex min-h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-teal-200 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-teal-200"
                }
              >
                Semua
              </Link>
              {filterChips.map((chip) => (
                <Link
                  key={chip.value}
                  href={analyticsFilterHref(chip.value, {
                    status,
                    q,
                    category: selectedCategory,
                  })}
                  scroll={false}
                  className={
                    activeFilter === chip.value
                      ? "inline-flex min-h-9 shrink-0 items-center rounded-full border border-teal-200 bg-teal-50 px-3 text-xs font-bold text-teal-800 shadow-sm ring-1 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20"
                      : "inline-flex min-h-9 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:border-teal-200 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-teal-200"
                  }
                >
                  {chip.label}
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
                      <ProductImage name={product.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950 dark:text-white">
                          {product.name}
                        </p>
                        {productIdentityMeta(product) ? (
                          <p className="mt-0.5 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                            {productIdentityMeta(product)}
                          </p>
                        ) : null}
                        {velocityById ? (
                          <VelocityBadge velocity={velocityById.get(product.id)} />
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
                            variant: product.variant,
                            price: product.price,
                            costPrice: product.costPrice,
                            stock: product.stock,
                            minStock: product.minStock,
                            unit: product.unit,
                            category: product.category,
                            supplierName: product.supplier?.name ?? null,
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
              className="mobile-card-surface relative p-2.5 active:bg-slate-50 dark:active:bg-slate-900 sm:rounded-2xl sm:p-4"
            >
              {velocityById ? (
                <VelocityStrip velocity={velocityById.get(product.id)} />
              ) : null}
              <div
                className={`flex min-w-0 items-start gap-2.5 sm:gap-4 ${
                  canManage ? "pr-10 sm:pr-0" : ""
                }`}
              >
                <ProductImage
                  name={product.name}
                  className="h-9 w-9 rounded-lg sm:h-12 sm:w-12 sm:rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-1 break-words text-[15px] font-bold leading-snug text-slate-950 dark:text-white sm:line-clamp-2 sm:text-base">
                        {product.name}
                      </p>
                      {productIdentityMeta(product) ? (
                        <p className="mt-0.5 line-clamp-1 break-words text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {productIdentityMeta(product)}
                        </p>
                      ) : null}
                      <p className="mt-1 line-clamp-1 break-words text-xs text-slate-500 dark:text-slate-400">
                        {product.sku ?? product.barcode ?? "-"} -{" "}
                        {productCategoryLocationMeta(product)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 whitespace-nowrap text-right text-[15px] font-extrabold tabular-nums text-slate-950 dark:text-white sm:text-base ${
                        canManage ? "hidden sm:block" : ""
                      }`}
                    >
                      {rupiah(product.price)}
                      <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                        / {product.unit}
                      </span>
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-2 text-sm sm:mt-3 sm:gap-2 sm:text-xs">
                    <div className="text-center px-0 py-0 sm:rounded-xl sm:border sm:border-slate-100 sm:bg-slate-50/80 sm:px-3 sm:py-2 dark:sm:border-slate-800 dark:sm:bg-slate-900/70">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
                    <div className="text-center px-0 py-0 sm:rounded-xl sm:border sm:border-slate-100 sm:bg-slate-50/80 sm:px-3 sm:py-2 dark:sm:border-slate-800 dark:sm:bg-slate-900/70">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Min
                      </p>
                      <p className="mt-0.5 font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {product.minStock}
                      </p>
                    </div>
                    <div className="text-center px-0 py-0 sm:rounded-xl sm:border sm:border-slate-100 sm:bg-slate-50/80 sm:px-3 sm:py-2 dark:sm:border-slate-800 dark:sm:bg-slate-900/70">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
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
                      <div className="col-span-3 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:gap-2">
                        <span
                          className={`px-0 py-0 font-bold tabular-nums text-slate-600 dark:text-slate-300 sm:rounded-xl sm:border sm:border-slate-100 sm:bg-slate-50/80 sm:px-3 sm:py-2 dark:sm:border-slate-800 dark:sm:bg-slate-900/70 ${
                            canManage ? "hidden sm:block" : ""
                          }`}
                        >
                          HPP{" "}
                          {product.costPrice > 0
                            ? rupiah(product.costPrice)
                            : "belum lengkap"}
                        </span>
                        <span
                          className={`px-0 py-0 font-bold tabular-nums text-emerald-700 dark:text-emerald-300 sm:rounded-xl sm:border sm:border-slate-100 sm:bg-slate-50/80 sm:px-3 sm:py-2 dark:sm:border-slate-800 dark:sm:bg-slate-900/70 ${
                            canManage ? "hidden sm:block" : ""
                          }`}
                        >
                          Margin {marginLabel(product.price, product.costPrice)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {canManage ? (
                <ProductActionsMenu
                  hasTopStrip={Boolean(velocityById?.get(product.id))}
                  compactFigures={
                    product.price >= 1_000_000 || product.costPrice >= 1_000_000
                  }
                  price={rupiah(product.price)}
                  unit={product.unit}
                  margin={
                    canViewCost
                      ? marginLabel(product.price, product.costPrice)
                      : null
                  }
                  hpp={
                    canViewCost
                      ? product.costPrice > 0
                        ? rupiah(product.costPrice)
                        : "belum lengkap"
                      : null
                  }
                >
                    <ProductEditButton
                      product={{
                        id: product.id,
                        sku: product.sku,
                        barcode: product.barcode,
                        name: product.name,
                        brand: product.brand,
                        variant: product.variant,
                        price: product.price,
                        costPrice: product.costPrice,
                        stock: product.stock,
                        minStock: product.minStock,
                        unit: product.unit,
                        category: product.category,
                        supplierName: product.supplier?.name ?? null,
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
                </ProductActionsMenu>
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
              filter: activeFilter ?? "",
            })
          }
        />
      </section>
    </div>
  );
}
