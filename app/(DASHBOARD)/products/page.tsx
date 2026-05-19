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
import LiveSearchInput from "@/components/search/live-search-input";
import PaginationLinks from "@/components/ui/pagination-links";
import { canManageProducts, canViewCostPrice } from "@/lib/auth-session";
import { requireProtectedPage } from "@/lib/page-guards";
import { prisma } from "@/lib/prisma";

type ProductsPageProps = {
  searchParams?: Promise<{
    status?: string;
    q?: string;
    category?: string;
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

function statusHref(
  status: "active" | "inactive" | "all",
  params: {
    q: string;
    category: string;
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

  const next = query.toString();

  return next ? `/products?${next}` : "/products";
}

function pageHref(
  page: number,
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

  if (page > 1) {
    query.set("page", String(page));
  }

  const next = query.toString();

  return next ? `/products?${next}` : "/products";
}

function ProductImage({
  imageUrl,
  name,
}: {
  imageUrl: string | null;
  name: string;
}) {
  if (imageUrl) {
    return (
      <span
        className="block h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-cover bg-center dark:border-slate-800"
        style={{ backgroundImage: `url("${imageUrl}")` }}
        aria-label={name}
      />
    );
  }

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
      <Package className="h-6 w-6" />
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
  const currentPage = Math.max(Number(params.page ?? 1) || 1, 1);
  const where: Prisma.ProductWhereInput = {
    ...(status === "all" ? {} : { isActive: status === "active" }),
    ...(selectedCategory ? { category: selectedCategory } : {}),
    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              sku: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              barcode: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              category: {
                contains: q,
                mode: "insensitive",
              },
            },
          ],
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
    <div className="space-y-6 overflow-x-hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Inventory Produk
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Sistem POS Toko Pancing
          </p>
        </div>

        {canManage ? (
          <div className="grid gap-3 sm:flex-row sm:grid-cols-2 lg:flex">
            <Link
              href="/products/import"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 active:scale-95 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100"
            >
              <Upload size={18} />
              Import Excel
            </Link>
            <Link
              href="/products/create"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-teal-600 px-5 text-sm font-bold text-white shadow-lg shadow-teal-900/10 transition duration-200 hover:-translate-y-0.5 hover:bg-teal-700 active:scale-95"
            >
              <Plus size={18} />
              Tambah Produk
            </Link>
          </div>
        ) : null}
      </div>

      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${canViewCost ? "xl:grid-cols-4" : "lg:grid-cols-2"}`}>
        <Link
          href="/products?status=all"
          className="flex min-h-32 items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 sm:p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-14 sm:w-14">
            <Package className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Produk
            </span>
            <span className="mt-1 block whitespace-nowrap text-2xl font-extrabold text-slate-950 dark:text-white">
              {totalProducts}
            </span>
            <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              Produk
            </span>
          </span>
        </Link>

        <Link
          href="/products"
          className="flex min-h-32 items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 sm:p-5"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-14 sm:w-14">
            <Boxes className="h-6 w-6 sm:h-7 sm:w-7" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
              Total Stok
            </span>
            <span className="mt-1 block whitespace-nowrap text-2xl font-extrabold text-slate-950 dark:text-white">
              {totalStock}
            </span>
            <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
              Unit
            </span>
          </span>
        </Link>

        {canViewCost ? (
          <Link
            href="/reports"
            className="flex min-h-32 items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/70 sm:p-5"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-teal-700 dark:bg-emerald-500/15 dark:text-teal-200 sm:h-14 sm:w-14">
              <DollarSign className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
                Nilai Jual Stok
              </span>
            <span className="mt-1 block break-words text-xl font-extrabold tabular-nums text-slate-950 dark:text-white sm:text-2xl">
                {rupiah(totalInventory)}
              </span>
              <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                Harga jual x stok
              </span>
            </span>
          </Link>
        ) : null}

        {canViewCost ? (
          <div className="flex min-h-32 items-center gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70 sm:p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:h-14 sm:w-14">
              <DollarSign className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 sm:text-sm">
                Nilai Modal Stok
              </span>
              <span className="mt-1 block break-words text-xl font-extrabold tabular-nums text-slate-950 dark:text-white sm:text-2xl">
                {rupiah(totalCostInventory)}
              </span>
              <span className="mt-1 block text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                {hasCostPrice ? "HPP x stok" : "HPP belum tersedia"}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="flex flex-col gap-5 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              Daftar Produk
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Produk active tampil di POS. Produk inactive tersimpan untuk histori.
            </p>
          </div>

          {canManage ? (
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900">
              {statusFilters.map((filter) => (
                <Link
                  key={filter.value}
                  href={statusHref(filter.value, {
                    q,
                    category: selectedCategory,
                  })}
                  className={
                    status === filter.value
                      ? "inline-flex h-11 items-center justify-center rounded-xl bg-teal-600 px-4 text-sm font-bold text-white shadow-sm hover:bg-teal-700"
                      : "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-600 transition hover:bg-white hover:text-teal-700 dark:text-slate-300 dark:hover:bg-slate-950"
                  }
                >
                  {filter.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <form className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_270px_auto] dark:border-slate-800">
          {status !== "active" ? (
            <input type="hidden" name="status" value={status} />
          ) : null}
          <LiveSearchInput
            initialValue={q}
            placeholder="Cari nama produk, SKU, barcode..."
          />
          <select
            name="category"
            defaultValue={selectedCategory}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
          >
            <option value="">Semua kategori/laci</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 active:scale-95 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            type="submit"
          >
            <Filter className="h-4 w-4" />
            Filter
          </button>
        </form>

        <div className="hidden lg:block">
          <table className="w-full table-fixed text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <tr>
                <th className="w-[18%] px-5 py-4">Nama Produk</th>
                <th className="w-[14%] px-5 py-4">SKU / Kategori</th>
                <th className="w-[11%] px-5 py-4">Harga Jual</th>
                {canViewCost ? (
                  <>
                    <th className="w-[12%] px-5 py-4">Harga Modal / HPP</th>
                    <th className="w-[12%] px-5 py-4">Margin Est.</th>
                  </>
                ) : null}
                <th className="w-[6%] px-5 py-4">Stok</th>
                <th className="w-[7%] px-5 py-4">Status</th>
                {canManage ? (
                  <th className="w-[20%] px-5 py-4 text-right">Aksi</th>
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
                  <td className="px-5 py-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <ProductImage imageUrl={product.imageUrl} name={product.name} />
                      <span className="min-w-0 truncate font-bold text-slate-950 dark:text-white">
                        {product.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <p className="truncate font-bold text-slate-950 dark:text-white">
                      {product.sku ?? product.barcode ?? "-"}
                    </p>
                    <p className="mt-1 truncate text-slate-500 dark:text-slate-400">
                      {product.category ?? "Tanpa kategori"}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 font-semibold tabular-nums text-slate-950 dark:text-white">
                    {rupiah(product.price)}
                  </td>
                  {canViewCost ? (
                    <>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold tabular-nums text-slate-950 dark:text-white">
                        {product.costPrice > 0 ? rupiah(product.costPrice) : "-"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={
                            product.costPrice > 0 && product.price - product.costPrice >= 0
                              ? "rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200"
                              : "rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          }
                        >
                          {marginLabel(product.price, product.costPrice)}
                        </span>
                      </td>
                    </>
                  ) : null}
                  <td className="px-5 py-4">
                    <span className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-bold tabular-nums text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={
                        product.isActive
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                          : "rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      }
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage ? (
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        <ProductStatusActionButton
                          productId={product.id}
                          productName={product.name}
                          isActive={product.isActive}
                        />
                        <ProductEditButton
                          product={{
                            id: product.id,
                            sku: product.sku,
                            barcode: product.barcode,
                            name: product.name,
                            price: product.price,
                            costPrice: product.costPrice,
                            stock: product.stock,
                            minStock: product.minStock,
                            unit: product.unit,
                            category: product.category,
                            description: product.description,
                            imageUrl: product.imageUrl,
                          }}
                          categories={categoryOptions}
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 bg-slate-50/70 p-4 lg:hidden dark:bg-slate-900/30">
          {products.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              Tidak ada produk pada filter ini.
            </div>
          ) : null}
          {products.map((product) => (
            <div
              key={product.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex min-w-0 items-start gap-4">
                <ProductImage imageUrl={product.imageUrl} name={product.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words font-bold text-slate-950 dark:text-white">
                        {product.name}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
                        {product.sku ?? product.barcode ?? "-"} -{" "}
                        {product.category ?? "Tanpa kategori"}
                      </p>
                    </div>
                    <span className="w-fit break-words text-sm font-extrabold tabular-nums text-slate-950 dark:text-white sm:shrink-0 sm:whitespace-nowrap">
                      {rupiah(product.price)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
                      Stok {product.stock}
                    </span>
                    <span
                      className={
                        product.isActive
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                          : "rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      }
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                    {canViewCost ? (
                      <>
                        <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          HPP {product.costPrice > 0 ? rupiah(product.costPrice) : "-"}
                        </span>
                        <span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold tabular-nums text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          Margin {marginLabel(product.price, product.costPrice)}
                        </span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              {canManage ? (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <ProductStatusActionButton
                    productId={product.id}
                    productName={product.name}
                    isActive={product.isActive}
                  />
                  <ProductEditButton
                    product={{
                      id: product.id,
                      sku: product.sku,
                      barcode: product.barcode,
                      name: product.name,
                      price: product.price,
                      costPrice: product.costPrice,
                      stock: product.stock,
                      minStock: product.minStock,
                      unit: product.unit,
                      category: product.category,
                      description: product.description,
                      imageUrl: product.imageUrl,
                    }}
                    categories={categoryOptions}
                  />
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
            })
          }
        />
      </section>
    </div>
  );
}
