"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Fish,
  Grid2X2,
  List,
  Package,
  PackageSearch,
  ShoppingBag,
  ShoppingCart,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import SaleMessageActions from "@/components/message-actions/sale-message-actions";
import PaymentConfirmationModal from "@/components/pos/payment-confirmation-modal";
import ThemeToggle from "@/components/layout/theme-toggle";
import LocalLiveSearchInput from "@/components/search/local-live-search-input";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  imageUrl?: string | null;
  price: number;
  stock: number;
};

type ApiProduct = {
  id: number;
  name: string;
  sku: string | null;
  barcode?: string | null;
  category: string | { name?: string | null } | null;
  image_url?: string | null;
  selling_price: number | string;
  current_stock: number | string;
};

type CartItem = Product & {
  qty: number;
};

type UserPayload = {
  name: string;
  email: string;
  role?: {
    name: string;
    slug: string;
  } | null;
};

type CustomerLookup = {
  id: number;
  customerCode: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

type CheckoutSuccess = {
  id: string;
  invoiceNumber: string;
  total: number;
  paymentMethod: string;
};

type PaymentMethod = {
  code: string;
  name: string;
  type: string;
};

type PaymentSettings = {
  bankName: string;
  bankAccountNumber: string;
  bankAccountOwner: string;
  qrisImageUrl: string;
};

type SummaryStats = {
  totalProducts: number;
  lowStockCount: number;
  todayTransactions: number;
  totalSales: number;
};

type SummaryDetailType =
  | "total-products"
  | "low-stock"
  | "today-transactions"
  | "total-sales";

type SummaryDetailItem = {
  id: number | string;
  name?: string;
  sku?: string;
  category?: string;
  stock?: number;
  minStock?: number;
  amount?: number;
  invoiceNumber?: string;
  createdAt?: string;
  customer?: string;
  cashier?: string;
  itemCount?: number;
  paymentMethod?: string;
};

type SummaryDetail = {
  title: string;
  description: string;
  total?: number;
  count?: number;
  items: SummaryDetailItem[];
};

const TOKEN_KEY = "fishing_pos_token";
const USER_KEY = "fishing_pos_user";

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function readCategory(category: ApiProduct["category"]) {
  if (!category) {
    return "Tanpa kategori";
  }

  if (typeof category === "string") {
    return category;
  }

  return category.name ?? "Tanpa kategori";
}

function readStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(USER_KEY);

  return value ? (JSON.parse(value) as UserPayload) : null;
}

function categoryIconElement(category: string, className = "h-4 w-4"): ReactNode {
  const normalized = category.toLowerCase();

  if (normalized.includes("kail") || normalized.includes("hook")) {
    return <CircleDot className={className} />;
  }

  if (normalized.includes("reel")) {
    return <Boxes className={className} />;
  }

  if (normalized.includes("senar") || normalized.includes("line")) {
    return <Fish className={className} />;
  }

  if (normalized.includes("umpan") || normalized.includes("lure")) {
    return <Fish className={className} />;
  }

  if (normalized.includes("aksesoris")) {
    return <ShoppingBag className={className} />;
  }

  return <Package className={className} />;
}

function ProductThumb({ product }: { product: Product }) {
  if (product.imageUrl) {
    return (
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-50 bg-contain bg-center bg-no-repeat"
        role="img"
        aria-label={product.name}
        style={{
          backgroundImage: `url("${product.imageUrl}")`,
        }}
      >
        <span className="sr-only">{product.name}</span>
      </div>
    );
  }

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-teal-100 bg-teal-50 text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300">
      {categoryIconElement(product.category, "h-9 w-9")}
    </div>
  );
}

type PosAppProps = {
  currentUser: UserPayload;
  paymentMethods: PaymentMethod[];
  paymentSettings: PaymentSettings;
};

export default function PosApp({
  currentUser,
  paymentMethods,
  paymentSettings,
}: PosAppProps) {
  const [token, setToken] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(TOKEN_KEY) ?? "",
  );
  const [user, setUser] = useState<UserPayload | null>(
    () => readStoredUser() ?? currentUser,
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [visibleCount, setVisibleCount] = useState(6);
  const [productView, setProductView] = useState<"grid" | "list">("grid");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [summary, setSummary] = useState<SummaryStats>({
    totalProducts: 0,
    lowStockCount: 0,
    todayTransactions: 0,
    totalSales: 0,
  });
  const [summaryDetail, setSummaryDetail] = useState<SummaryDetail | null>(
    null,
  );
  const [summaryLoading, setSummaryLoading] = useState<SummaryDetailType | null>(
    null,
  );
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<CustomerLookup | null>(
    null,
  );
  const [normalizedCustomerPhone, setNormalizedCustomerPhone] = useState("");
  const [customerLookupMessage, setCustomerLookupMessage] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(
    () =>
      paymentMethods.find((method) => method.code === "CASH")?.code ??
      paymentMethods[0]?.code ??
      "CASH",
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [lastSaleId, setLastSaleId] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] =
    useState<CheckoutSuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  const request = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? data?.error ?? "Request gagal");
      }

      return data;
    },
    [token],
  );

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    setErrorMessage("");

    try {
      const params = new URLSearchParams({
        per_page: "100",
      });

      const data = await request(`/api/products?${params.toString()}`);
      const mappedProducts = (data.data ?? []).map((product: ApiProduct) => ({
        id: product.id,
        name: product.name,
        sku: product.sku ?? "-",
        barcode: product.barcode ?? "",
        category: readCategory(product.category),
        imageUrl: product.image_url ?? null,
        price: Number(product.selling_price),
        stock: Number(product.current_stock),
      }));

      setProducts(mappedProducts);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memuat produk";
      setErrorMessage(message);

      if (message === "Unauthenticated.") {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(USER_KEY);
        setToken("");
        setUser(null);
        window.location.href = "/login";
      }
    } finally {
      setLoadingProducts(false);
    }
  }, [request]);

  const fetchSummary = useCallback(async () => {
    const data = await request("/api/pos/summary");
    setSummary({
      totalProducts: Number(data.data?.totalProducts ?? 0),
      lowStockCount: Number(data.data?.lowStockCount ?? 0),
      todayTransactions: Number(data.data?.todayTransactions ?? 0),
      totalSales: Number(data.data?.totalSales ?? 0),
    });
  }, [request]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchProducts();
      void fetchSummary();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchProducts, fetchSummary]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const phone = customerPhone.trim();

      if (!phone) {
        setFoundCustomer(null);
        setNormalizedCustomerPhone("");
        setCustomerLookupMessage("");
        return;
      }

      setLoadingCustomer(true);

      try {
        const data = await request(
          `/api/customers?phone=${encodeURIComponent(phone)}`,
        );

        setNormalizedCustomerPhone(data.normalized_phone ?? "");

        if (data.found && data.data) {
          const customer = data.data as CustomerLookup;
          setFoundCustomer(customer);
          setCustomerName(customer.name);
          setCustomerAddress(customer.address ?? "");
          setCustomerLookupMessage("Customer lama ditemukan");
        } else {
          setFoundCustomer(null);
          setCustomerLookupMessage("Customer baru akan dibuat saat checkout");
        }
      } catch (error) {
        setFoundCustomer(null);
        setCustomerLookupMessage(
          error instanceof Error ? error.message : "Gagal mencari customer",
        );
      } finally {
        setLoadingCustomer(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [customerPhone, request]);

  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => {
      return acc + item.price * item.qty;
    }, 0);
  }, [cart]);
  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.code === paymentMethod,
  );
  const cartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.qty, 0);
  }, [cart]);
  const categoryOptions = useMemo(() => {
    return Array.from(
      new Set(products.map((product) => product.category).filter(Boolean)),
    );
  }, [products]);
  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatched =
        selectedCategory === "Semua" || product.category === selectedCategory;
      const name = product.name?.toLowerCase() || "";
      const sku = product.sku?.toLowerCase() || "";
      const barcode = product.barcode?.toLowerCase() || "";
      const category = product.category?.toLowerCase() || "";
      const keywordMatched =
        !keyword ||
        name.includes(keyword) ||
        sku.includes(keyword) ||
        barcode.includes(keyword) ||
        category.includes(keyword);

      return categoryMatched && keywordMatched;
    });
  }, [products, search, selectedCategory]);
  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );
  const currentRole = user?.role?.slug ?? currentUser.role?.slug ?? "cashier";
  const canOpenInventoryDetails =
    currentRole === "owner" || currentRole === "developer";

  function addToCart(product: Product) {
    setSuccessMessage("");
    setLastSaleId("");
    setCheckoutSuccess(null);
    setErrorMessage("");

    if (product.stock <= 0) {
      setErrorMessage("Stok produk habis");
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                qty: Math.min(item.qty + 1, product.stock),
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          ...product,
          qty: 1,
        },
      ];
    });
  }

  function increaseQty(id: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              qty: Math.min(item.qty + 1, item.stock),
            }
          : item,
      ),
    );
  }

  function decreaseQty(id: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? {
                ...item,
                qty: item.qty - 1,
              }
            : item,
        )
        .filter((item) => item.qty > 0),
    );
  }

  function checkoutPaidAmount() {
    return paidAmount ? Number(paidAmount) : subtotal;
  }

  function paymentSettingsReady() {
    if (selectedPaymentMethod?.type === "QRIS" && !paymentSettings.qrisImageUrl) {
      setErrorMessage("QRIS belum disetting di Pengaturan.");
      return false;
    }

    if (
      selectedPaymentMethod?.type === "BANK_TRANSFER" &&
      (!paymentSettings.bankName ||
        !paymentSettings.bankAccountNumber ||
        !paymentSettings.bankAccountOwner)
    ) {
      setErrorMessage("Rekening bank belum disetting di Pengaturan.");
      return false;
    }

    return true;
  }

  function initiateCheckout() {
    if (cart.length === 0) {
      setErrorMessage("Cart kosong");
      return;
    }

    const paid = checkoutPaidAmount();

    if (!Number.isFinite(paid) || paid < subtotal) {
      setErrorMessage("Pembayaran kurang");
      return;
    }

    if (!paymentSettingsReady()) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setPaymentModalOpen(true);
  }

  async function finalizeCheckout() {
    if (loadingCheckout) {
      return;
    }

    const paid = checkoutPaidAmount();

    setLoadingCheckout(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await request("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          paid_amount: paid,
          payment_method: paymentMethod,
          customer: customerPhone.trim()
            ? {
                name: customerName,
                phone: customerPhone,
                address: customerAddress,
              }
            : undefined,
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.qty,
          })),
        }),
      });

      setSuccessMessage(
        `Transaksi berhasil - ${response.data?.sale_number ?? ""}`,
      );
      setLastSaleId(response.data?.id ?? "");
      setCheckoutSuccess({
        id: response.data?.id ?? "",
        invoiceNumber: response.data?.sale_number ?? "",
        total: Number(response.data?.grand_total ?? 0),
        paymentMethod: response.data?.payment_method ?? "cash",
      });
      setCart([]);
      setPaidAmount("");
      setPaymentModalOpen(false);
      setPaymentMethod(
        paymentMethods.find((method) => method.code === "CASH")?.code ??
          paymentMethods[0]?.code ??
          "CASH",
      );
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setFoundCustomer(null);
      setNormalizedCustomerPhone("");
      setCustomerLookupMessage("");
      await fetchProducts();
      await fetchSummary();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Checkout gagal");
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function logout() {
    try {
      await request("/api/logout", {
        method: "POST",
      });
    } catch {
      // Token lokal tetap dibersihkan agar kasir bisa login ulang.
    }

    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setToken("");
    setUser(null);
    setProducts([]);
    setCart([]);
    setPaidAmount("");
    setPaymentMethod(
      paymentMethods.find((method) => method.code === "CASH")?.code ??
        paymentMethods[0]?.code ??
        "CASH",
    );
    setSuccessMessage("");
    setLastSaleId("");
    setCheckoutSuccess(null);
    setPaymentModalOpen(false);
    setErrorMessage("");
    window.location.href = "/login";
  }

  async function openSummaryDetail(type: SummaryDetailType) {
    if (type === "total-products" && !canOpenInventoryDetails) {
      return;
    }

    setSummaryLoading(type);
    setErrorMessage("");

    try {
      const data = await request(`/api/pos/summary?detail=${type}`);
      setSummaryDetail(data.data as SummaryDetail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal memuat detail summary",
      );
    } finally {
      setSummaryLoading(null);
    }
  }

  return (
    <main className="w-full min-w-0 pb-4 text-slate-950 dark:text-slate-50">
      <PaymentConfirmationModal
        open={paymentModalOpen}
        paymentMethod={selectedPaymentMethod}
        paymentSettings={paymentSettings}
        total={subtotal}
        paidAmount={checkoutPaidAmount()}
        loading={loadingCheckout}
        onConfirm={finalizeCheckout}
        onCancel={() => {
          if (!loadingCheckout) {
            setPaymentModalOpen(false);
          }
        }}
      />

      {summaryDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 text-slate-950 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{summaryDetail.title}</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {summaryDetail.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSummaryDetail(null)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Tutup
              </button>
            </div>

            {summaryDetail.total !== undefined ? (
              <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
                <span className="text-slate-500 dark:text-slate-400">
                  Total
                </span>{" "}
                <span className="font-bold tabular-nums">
                  {rupiah(summaryDetail.total)}
                </span>
                {summaryDetail.count !== undefined ? (
                  <span className="ml-3 text-slate-500 dark:text-slate-400">
                    {summaryDetail.count} transaksi
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3">
              {summaryDetail.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Tidak ada data.
                </div>
              ) : null}
              {summaryDetail.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  {item.invoiceNumber ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold">{item.invoiceNumber}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {item.createdAt ? formatDate(item.createdAt) : "-"} -{" "}
                          {item.customer ?? "Walk-in"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {item.cashier} - {item.itemCount ?? 0} item -{" "}
                          {item.paymentMethod}
                        </p>
                      </div>
                      <p className="font-bold tabular-nums">
                        {rupiah(item.amount ?? 0)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{item.name}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {item.sku ?? "-"}
                          {item.category ? ` - ${item.category}` : ""}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {item.stock !== undefined ? (
                          <p className="font-bold tabular-nums">
                            Stok {item.stock}
                          </p>
                        ) : null}
                        {item.amount !== undefined ? (
                          <p className="font-bold tabular-nums">
                            {rupiah(item.amount)}
                          </p>
                        ) : null}
                        {item.minStock !== undefined ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Min {item.minStock}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
            Fishing POS
          </h1>
          <p className="mt-2 text-base text-slate-500 dark:text-slate-400">
            Sistem kasir toko pancing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800"
              type="button"
              aria-label="Notifikasi"
              aria-expanded={notificationsOpen}
            >
              <Bell className="h-5 w-5" />
            </button>
            {notificationsOpen ? (
              <div className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Belum ada notifikasi
              </div>
            ) : null}
          </div>
          <button
            onClick={logout}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            type="button"
          >
            Logout
          </button>
        </div>
      </header>

      {successMessage && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{successMessage}</span>
            {lastSaleId ? (
              <Link
                href={`/invoices/${lastSaleId}`}
                className="font-semibold underline underline-offset-4"
              >
                Lihat Invoice
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {checkoutSuccess ? (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Checkout Success
              </p>
              <h2 className="metric-value text-xl">
                {checkoutSuccess.invoiceNumber}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Total{" "}
                <span className="tabular-nums">
                  {rupiah(checkoutSuccess.total)}
                </span>{" "}
                - {checkoutSuccess.paymentMethod}
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href={`/invoices/${checkoutSuccess.id}?print=1`}
                target="_blank"
                className="min-h-10 rounded-xl bg-teal-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors duration-200 hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
              >
                Print Invoice
              </Link>
              <Link
                href={`/invoices/${checkoutSuccess.id}`}
                className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-center text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Open Invoice
              </Link>
              <div className="sm:col-span-2">
                <SaleMessageActions saleId={checkoutSuccess.id} compact />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="min-w-0 space-y-6">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-950 dark:text-slate-50">
                Produk
              </h2>
            </div>

            <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_56px]">
              <LocalLiveSearchInput
                value={search}
                onSearch={(value) => {
                  setSearch(value);
                  setVisibleCount(6);
                }}
                placeholder="Cari produk, SKU, barcode..."
              />

              <label className="relative block">
                <select
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value);
                    setVisibleCount(6);
                  }}
                  className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-700 outline-none transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="Semua">Semua Kategori</option>
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </label>

              <button
                onClick={() =>
                  setProductView((view) => (view === "grid" ? "list" : "grid"))
                }
                className={
                  productView === "grid"
                    ? "flex min-h-12 items-center justify-center rounded-xl border border-teal-200 bg-teal-50 text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200"
                    : "flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
                }
                type="button"
                aria-label={
                  productView === "grid"
                    ? "Tampilan grid aktif"
                    : "Tampilan list aktif"
                }
              >
                {productView === "grid" ? (
                  <Grid2X2 className="h-5 w-5" />
                ) : (
                  <List className="h-5 w-5" />
                )}
              </button>
            </div>

            <div className="mb-5 h-px bg-slate-100 dark:bg-slate-800" />

            {loadingProducts ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Memuat produk
              </div>
            ) : null}

            {!loadingProducts && filteredProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Produk tidak ditemukan
              </div>
            ) : null}

            <div
              className={
                productView === "grid"
                  ? "grid gap-4 md:grid-cols-2 min-[1450px]:grid-cols-3"
                  : "grid gap-4"
              }
            >
              {visibleProducts.map((product) => (
                <article
                  key={product.id}
                  className="grid min-h-[146px] grid-cols-[80px_minmax(0,1fr)] gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors duration-200 hover:border-teal-200 hover:bg-teal-50/30 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10"
                >
                  <ProductThumb product={product} />

                  <div className="flex min-w-0 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 break-words text-base font-bold leading-snug text-slate-950 dark:text-slate-50">
                          {product.name}
                        </h3>
                        <p className="mt-2 truncate text-sm text-slate-500 dark:text-slate-400">
                          {product.sku}
                        </p>
                      </div>

                      <button
                        onClick={() => addToCart(product)}
                        disabled={product.stock <= 0}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-lg font-bold text-teal-700 transition-colors duration-200 hover:bg-teal-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500/20 dark:text-teal-200 dark:hover:bg-teal-500/30"
                        type="button"
                        aria-label={`Tambah ${product.name}`}
                      >
                        +
                      </button>
                    </div>

                    <div className="mt-auto pt-4">
                      <p className="metric-value text-base">
                        {rupiah(product.price)}
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                          {product.category}
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Stok {product.stock}
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {filteredProducts.length > visibleCount ? (
              <div className="mt-5 flex justify-center">
                <button
                  onClick={() => setVisibleCount((count) => count + 6)}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 dark:border-teal-500/30 dark:bg-slate-950 dark:text-teal-300 dark:hover:bg-teal-500/10"
                  type="button"
                >
                  Lihat lebih banyak
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="mb-4 text-xl font-bold text-slate-950 dark:text-slate-50">
              Kategori
            </h2>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {["Semua", ...categoryOptions].map((category) => {
                const active = selectedCategory === category;

                return (
                  <button
                    key={category}
                    onClick={() => {
                      setSelectedCategory(category);
                      setVisibleCount(6);
                    }}
                    className={
                      active
                        ? "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700 shadow-sm dark:border-teal-500/40 dark:bg-teal-500/10 dark:text-teal-200"
                        : "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    }
                    type="button"
                  >
                    {category === "Semua" ? (
                      <PackageSearch className="h-4 w-4" />
                    ) : (
                      categoryIconElement(category)
                    )}
                    {category}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {canOpenInventoryDetails ? (
              <button
                type="button"
                onClick={() => openSummaryDetail("total-products")}
                className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">
                  <Package className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total Produk
                  </p>
                  <p className="metric-value text-xl">
                    {summary.totalProducts}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {summaryLoading === "total-products"
                      ? "Memuat..."
                      : "Item tersedia"}
                  </p>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200">
                  <Package className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Total Produk
                  </p>
                  <p className="metric-value text-xl">
                    {summary.totalProducts}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Readonly
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => openSummaryDetail("low-stock")}
              className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                <PackageSearch className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Stok Rendah
                </p>
                <p className="metric-value text-xl">{summary.lowStockCount}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {summaryLoading === "low-stock"
                    ? "Memuat..."
                    : "Perlu restock"}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSummaryDetail("today-transactions")}
              className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Transaksi Hari Ini
                </p>
                <p className="metric-value text-xl">
                  {summary.todayTransactions}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {summaryLoading === "today-transactions"
                    ? "Memuat..."
                    : currentRole === "cashier"
                      ? "Shift kasir"
                      : "Semua kasir"}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSummaryDetail("total-sales")}
              className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total Penjualan
                </p>
                <p className="metric-value text-xl">
                  {rupiah(summary.totalSales)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {summaryLoading === "total-sales"
                    ? "Memuat..."
                    : currentRole === "cashier"
                      ? "Shift kasir"
                      : "Hari ini"}
                </p>
              </div>
            </button>
          </section>
        </div>

        <aside className="min-w-0 space-y-5 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <User className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Customer
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nomor WhatsApp
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="08xxxxxxxxxx"
                  />
                  {customerPhone ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerPhone("");
                        setFoundCustomer(null);
                        setNormalizedCustomerPhone("");
                        setCustomerLookupMessage("");
                      }}
                      className="absolute right-3 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      aria-label="Bersihkan nomor customer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <Users className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  )}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nama Customer
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Nama customer (opsional)"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Alamat
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Opsional"
                />
              </div>

              {customerPhone ? (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {loadingCustomer
                    ? "Mencari customer..."
                    : customerLookupMessage}
                  {normalizedCustomerPhone ? (
                    <p className="mt-1 tabular-nums">
                      Normalized: {normalizedCustomerPhone}
                    </p>
                  ) : null}
                  {foundCustomer ? (
                    <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                      {foundCustomer.customerCode} - {foundCustomer.name}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-slate-900 dark:text-slate-100" />
                <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                  Keranjang
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {cartItemCount} item
              </span>
            </div>

            <div className="min-h-[220px] space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              {cart.length === 0 ? (
                <div className="flex min-h-[190px] flex-col items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
                  <ShoppingCart className="mb-4 h-12 w-12 text-slate-400" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">
                    Keranjang masih kosong
                  </p>
                  <p className="mt-1 text-xs">
                    Pilih produk untuk menambahkan ke keranjang
                  </p>
                </div>
              ) : null}

              {cart.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950 dark:text-slate-50">
                        {item.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {item.sku}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-slate-950 dark:text-slate-50">
                      {rupiah(item.price * item.qty)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => decreaseQty(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      type="button"
                    >
                      -
                    </button>
                    <span className="min-w-8 text-center font-bold tabular-nums">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => increaseQty(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-lg font-bold transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      type="button"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Subtotal
                </span>
                <span className="metric-value text-2xl">{rupiah(subtotal)}</span>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Payment Method
                </label>
                <label className="relative block">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm font-medium text-slate-900 outline-none transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {paymentMethods.map((method) => (
                      <option key={method.code} value={method.code}>
                        {method.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </label>
              </div>

              {selectedPaymentMethod?.type === "BANK_TRANSFER" ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
                  <p className="font-semibold">Transfer Bank</p>
                  <p className="mt-1 text-xs">
                    Detail rekening akan tampil jelas di modal checkout.
                  </p>
                </div>
              ) : null}

              {selectedPaymentMethod?.type === "QRIS" ? (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-800 dark:bg-teal-500/10 dark:text-teal-200">
                  <p className="font-semibold">QRIS Statis</p>
                  <p className="mt-1 text-xs">
                    QRIS besar akan tampil di modal checkout setelah kasir klik
                    Checkout.
                  </p>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Dibayar
                </label>
                <input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder={String(subtotal)}
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <button
                onClick={initiateCheckout}
                disabled={loadingCheckout || cart.length === 0}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-sm transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                type="button"
              >
                <ShoppingBag className="h-5 w-5" />
                {loadingCheckout ? "Memproses..." : "Checkout"}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
