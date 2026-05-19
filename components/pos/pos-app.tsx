"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { KeyboardEvent, ReactNode } from "react";
import SaleMessageActions from "@/components/message-actions/sale-message-actions";
import PaymentConfirmationModal from "@/components/pos/payment-confirmation-modal";
import ThemeToggle from "@/components/layout/theme-toggle";
import LocalLiveSearchInput from "@/components/search/local-live-search-input";
import ClientPaginationControl from "@/components/ui/client-pagination-control";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LOYALTY_MIN_PURCHASE_AMOUNT } from "@/lib/loyalty";

type Product = {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  imageUrl?: string | null;
  price: number;
  costPrice?: number | null;
  stock: number;
};

type ApiProduct = {
  id: number;
  name: string;
  sku: string | null;
  barcode?: string | null;
  category: string | { name?: string | null } | null;
  image_url?: string | null;
  cost_price?: number | string;
  selling_price: number | string;
  current_stock: number | string;
};

type DiscountType = "NONE" | "FIXED" | "PERCENT";

type CartItem = Product & {
  qty: number;
  discountType: DiscountType;
  discountValue: number;
  discountReason: string;
};

type DiscountDraft = {
  type: DiscountType;
  value: string;
  reason: string;
};

type LoyaltyBenefitType = "NONE" | "FIXED" | "PERCENT";

type LoyaltyProgress = {
  valid_transactions: number;
  next_milestone: number;
  remaining_to_next: number;
  eligible_milestone: number | null;
  reserved_milestones: number[];
};

type LoyaltyDraft = {
  type: LoyaltyBenefitType;
  value: string;
  note: string;
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
  loyaltyPoints?: number;
  loyalty_progress?: LoyaltyProgress | null;
};

type CustomerSuggestionType = "phone" | "name";

type CheckoutSuccess = {
  id: string;
  invoiceNumber: string;
  total: number;
  paymentMethod: string;
  transactionStatus: string;
  paymentStatus: string;
  paymentProofUrl?: string | null;
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
  transactionStatus?: string;
  paymentStatus?: string;
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
const POS_PRODUCT_PAGE_SIZE = 6;

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function cartLineSubtotalBeforeDiscount(item: CartItem) {
  return item.price * item.qty;
}

function discountAmountFor(
  type: DiscountType,
  value: number,
  subtotalBeforeDiscount: number,
) {
  if (type === "NONE") {
    return 0;
  }

  if (type === "PERCENT") {
    return Math.round((subtotalBeforeDiscount * value) / 100);
  }

  return Math.round(value);
}

function loyaltyDiscountAmountFor(
  type: LoyaltyBenefitType,
  value: number,
  subtotalBeforeLoyalty: number,
) {
  if (type === "NONE" || subtotalBeforeLoyalty <= 0) {
    return 0;
  }

  if (type === "PERCENT") {
    return Math.min(
      subtotalBeforeLoyalty,
      Math.round((subtotalBeforeLoyalty * value) / 100),
    );
  }

  return Math.min(subtotalBeforeLoyalty, Math.round(value));
}

function cartLineDiscountAmount(item: CartItem) {
  const subtotalBeforeDiscount = cartLineSubtotalBeforeDiscount(item);

  return discountAmountFor(
    item.discountType,
    item.discountValue,
    subtotalBeforeDiscount,
  );
}

function cartLineTotal(item: CartItem) {
  return Math.max(
    cartLineSubtotalBeforeDiscount(item) - cartLineDiscountAmount(item),
    0,
  );
}

function cartLineDiscountLabel(item: CartItem) {
  const amount = cartLineDiscountAmount(item);

  if (amount <= 0) {
    return "Tanpa diskon";
  }

  if (item.discountType === "PERCENT") {
    return `${item.discountValue}% (${rupiah(amount)})`;
  }

  return rupiah(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusBadgeClass(status: string) {
  if (status === "SUCCESS" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (status === "PENDING" || status === "WAITING_PROOF") {
    return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200";
  }

  if (status === "CANCELLED" || status === "FAILED") {
    return "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200";
  }

  return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";
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

function objectValue(value: unknown, key: string) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeCustomerSuggestion(raw: unknown): CustomerLookup {
  return {
    id: Number(objectValue(raw, "id") ?? 0),
    customerCode: stringValue(
      objectValue(raw, "customerCode") ?? objectValue(raw, "customer_code"),
    ),
    name: stringValue(objectValue(raw, "name")),
    phone: stringValue(objectValue(raw, "phone")) || null,
    address: stringValue(objectValue(raw, "address")) || null,
    notes: stringValue(objectValue(raw, "notes")) || null,
    loyaltyPoints: Number(
      objectValue(raw, "loyaltyPoints") ?? objectValue(raw, "loyalty_points") ?? 0,
    ),
    loyalty_progress:
      (objectValue(raw, "loyalty_progress") as LoyaltyProgress | null) ?? null,
  };
}

function normalizedPhoneDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function customerMatchesInput(
  customer: CustomerLookup | null,
  phone: string,
  name: string,
) {
  if (!customer) {
    return false;
  }

  return (
    normalizedPhoneDigits(customer.phone) === normalizedPhoneDigits(phone) &&
    customer.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
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
  const [productPage, setProductPage] = useState(1);
  const [productView, setProductView] = useState<"grid" | "list">("grid");
  const productSearchRef = useRef("");
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
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerLookup | null>(null);
  const [customerSuggestions, setCustomerSuggestions] = useState<
    CustomerLookup[]
  >([]);
  const [customerSuggestionType, setCustomerSuggestionType] =
    useState<CustomerSuggestionType | null>(null);
  const [customerSuggestionOpen, setCustomerSuggestionOpen] = useState(false);
  const [customerSuggestionLoading, setCustomerSuggestionLoading] =
    useState(false);
  const [activeCustomerSuggestionIndex, setActiveCustomerSuggestionIndex] =
    useState(0);
  const customerAutocompleteRef = useRef<HTMLDivElement | null>(null);
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
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofMessage, setProofMessage] = useState("");
  const [discountModalItemId, setDiscountModalItemId] = useState<number | null>(
    null,
  );
  const [discountDraft, setDiscountDraft] = useState<DiscountDraft>({
    type: "NONE",
    value: "0",
    reason: "",
  });
  const [discountModalError, setDiscountModalError] = useState("");
  const [loyaltyModalOpen, setLoyaltyModalOpen] = useState(false);
  const [loyaltyModalError, setLoyaltyModalError] = useState("");
  const [loyaltyConfirmedKey, setLoyaltyConfirmedKey] = useState("");
  const [loyaltyDraft, setLoyaltyDraft] = useState<LoyaltyDraft>({
    type: "NONE",
    value: "0",
    note: "",
  });

  const request = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const isFormData = init.body instanceof FormData;
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
        costPrice:
          product.cost_price === undefined ? null : Number(product.cost_price),
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

  const fetchActivePendingQris = useCallback(async () => {
    try {
      const response = await request("/api/sales?pending_qris=active");
      const sale = response.data;

      if (!sale) {
        setCheckoutSuccess((current) =>
          current?.paymentStatus === "WAITING_PROOF" ? null : current,
        );
        return;
      }

      setCheckoutSuccess({
        id: String(sale.id ?? ""),
        invoiceNumber: String(sale.sale_number ?? sale.invoice_number ?? ""),
        total: Number(sale.grand_total ?? 0),
        paymentMethod: String(sale.payment_method ?? "QRIS"),
        transactionStatus: String(sale.transaction_status ?? "PENDING"),
        paymentStatus: String(sale.payment_status ?? "WAITING_PROOF"),
        paymentProofUrl: sale.payment_proof_url ?? null,
      });
      setLastSaleId(String(sale.id ?? ""));
      setSuccessMessage(
        `Transaksi QRIS pending masih menunggu bukti - ${
          sale.sale_number ?? sale.invoice_number ?? ""
        }`,
      );
      setProofFile(null);
      setProofMessage("");
    } catch {
      // Panel pending bersifat pemulihan state; error utama POS tetap dari flow aktif.
    }
  }, [request]);

  function closeCustomerSuggestions() {
    setCustomerSuggestionOpen(false);
    setCustomerSuggestionType(null);
    setCustomerSuggestions([]);
    setActiveCustomerSuggestionIndex(0);
    setCustomerSuggestionLoading(false);
  }

  function selectCustomerSuggestion(customer: CustomerLookup) {
    setSelectedCustomer(customer);
    setFoundCustomer(customer);
    setCustomerPhone(customer.phone ?? "");
    setCustomerName(customer.name);
    setCustomerAddress(customer.address ?? "");
    setNormalizedCustomerPhone(customer.phone ?? "");
    setCustomerLookupMessage("Customer lama dipilih");
    setLoyaltyConfirmedKey("");
    closeCustomerSuggestions();
  }

  function handleCustomerManualEdit(
    nextValue: string,
    type: CustomerSuggestionType,
  ) {
    if (type === "phone") {
      setCustomerPhone(nextValue);
    } else {
      setCustomerName(nextValue);
    }

    setCustomerSuggestionType(type);
    setCustomerSuggestionOpen(true);
    setActiveCustomerSuggestionIndex(0);
    setCustomerLookupMessage("");

    const nextPhone = type === "phone" ? nextValue : customerPhone;
    const nextName = type === "name" ? nextValue : customerName;

    if (!customerMatchesInput(selectedCustomer, nextPhone, nextName)) {
      setSelectedCustomer(null);
      setFoundCustomer(null);
      setNormalizedCustomerPhone("");
      setLoyaltyConfirmedKey("");
    }
  }

  function handleCustomerSuggestionKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    type: CustomerSuggestionType,
  ) {
    if (event.key === "Escape") {
      closeCustomerSuggestions();
      return;
    }

    if (!customerSuggestionOpen || customerSuggestionType !== type) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveCustomerSuggestionIndex((current) =>
        Math.min(current + 1, Math.max(customerSuggestions.length - 1, 0)),
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveCustomerSuggestionIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && customerSuggestions.length > 0) {
      event.preventDefault();
      selectCustomerSuggestion(
        customerSuggestions[
          Math.min(activeCustomerSuggestionIndex, customerSuggestions.length - 1)
        ],
      );
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchProducts();
      void fetchSummary();
      void fetchActivePendingQris();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [fetchActivePendingQris, fetchProducts, fetchSummary]);

  useEffect(() => {
    if (!customerSuggestionOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (
        customerAutocompleteRef.current &&
        !customerAutocompleteRef.current.contains(event.target as Node)
      ) {
        closeCustomerSuggestions();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [customerSuggestionOpen]);

  useEffect(() => {
    if (!customerSuggestionType) {
      return;
    }

    const rawQuery =
      customerSuggestionType === "phone" ? customerPhone : customerName;
    const query =
      customerSuggestionType === "phone"
        ? normalizedPhoneDigits(rawQuery)
        : rawQuery.trim();
    const minimumLength = 2;

    if (
      query.length < minimumLength ||
      customerMatchesInput(selectedCustomer, customerPhone, customerName)
    ) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setCustomerSuggestionLoading(true);
        const data = await request(
          `/api/customers?q=${encodeURIComponent(
            rawQuery.trim(),
          )}&lookup=pos&type=${customerSuggestionType}&limit=8`,
        );
        const suggestions = Array.isArray(data.data)
          ? data.data.map(normalizeCustomerSuggestion)
          : [];

        setCustomerSuggestions(suggestions);
        setCustomerSuggestionOpen(true);
        setActiveCustomerSuggestionIndex(0);
      } catch {
        setCustomerSuggestions([]);
        setCustomerSuggestionOpen(false);
      } finally {
        setCustomerSuggestionLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    customerName,
    customerPhone,
    customerSuggestionType,
    request,
    selectedCustomer,
  ]);

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
      return acc + cartLineTotal(item);
    }, 0);
  }, [cart]);
  const subtotalBeforeDiscount = useMemo(() => {
    return cart.reduce((acc, item) => acc + cartLineSubtotalBeforeDiscount(item), 0);
  }, [cart]);
  const totalItemDiscount = useMemo(() => {
    return cart.reduce((acc, item) => acc + cartLineDiscountAmount(item), 0);
  }, [cart]);
  const loyaltyContextKey = `${foundCustomer?.id ?? "none"}:${subtotal}`;
  const loyaltyConfirmed = loyaltyConfirmedKey === loyaltyContextKey;
  const loyaltyProgress = foundCustomer?.loyalty_progress ?? null;
  const reservedMilestones = loyaltyProgress?.reserved_milestones ?? [];
  const reservedLoyaltyMilestone =
    loyaltyProgress?.eligible_milestone &&
    reservedMilestones.includes(loyaltyProgress.eligible_milestone)
      ? loyaltyProgress.eligible_milestone
      : null;
  const eligibleLoyaltyMilestone =
    loyaltyProgress?.eligible_milestone &&
    !reservedLoyaltyMilestone
      ? loyaltyProgress.eligible_milestone
      : null;
  const loyaltyMinimumMet = subtotal >= LOYALTY_MIN_PURCHASE_AMOUNT;
  const loyaltyMinimumShortfall = Math.max(
    LOYALTY_MIN_PURCHASE_AMOUNT - subtotal,
    0,
  );
  const loyaltyMinimumNote = `Belum memenuhi minimal pembelian loyalty ${rupiah(LOYALTY_MIN_PURCHASE_AMOUNT)}.`;
  const loyaltyMinimumStatus =
    eligibleLoyaltyMilestone && !loyaltyMinimumMet
      ? "belum_memenuhi"
      : "memenuhi";
  const loyaltyDraftValue = Number(loyaltyDraft.value || 0);
  const loyaltyPreviewDiscountAmount = loyaltyMinimumMet
    ? loyaltyDiscountAmountFor(
        loyaltyDraft.type,
        Number.isFinite(loyaltyDraftValue) ? Math.max(loyaltyDraftValue, 0) : 0,
        subtotal,
      )
    : 0;
  const loyaltyDiscountAmount =
    eligibleLoyaltyMilestone && loyaltyConfirmed && loyaltyMinimumMet
      ? loyaltyPreviewDiscountAmount
      : 0;
  const grandTotal = Math.max(subtotal - loyaltyDiscountAmount, 0);
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

  const productPageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / POS_PRODUCT_PAGE_SIZE),
  );
  const currentProductPage = Math.min(productPage, productPageCount);
  const visibleProducts = useMemo(
    () =>
      filteredProducts.slice(
        (currentProductPage - 1) * POS_PRODUCT_PAGE_SIZE,
        currentProductPage * POS_PRODUCT_PAGE_SIZE,
      ),
    [currentProductPage, filteredProducts],
  );
  const handleProductSearch = useCallback((value: string) => {
    if (productSearchRef.current === value) {
      return;
    }

    productSearchRef.current = value;
    setSearch(value);
    setProductPage(1);
  }, []);
  const handleProductPageChange = useCallback(
    (page: number) => {
      setProductPage(Math.min(Math.max(page, 1), productPageCount));
    },
    [productPageCount],
  );
  const currentRole = user?.role?.slug ?? currentUser.role?.slug ?? "cashier";
  const canOpenInventoryDetails =
    currentRole === "owner" || currentRole === "developer";
  const discountModalItem =
    discountModalItemId === null
      ? null
      : cart.find((item) => item.id === discountModalItemId) ?? null;
  const discountDraftValue = Number(discountDraft.value || 0);
  const discountDraftSubtotalBefore = discountModalItem
    ? cartLineSubtotalBeforeDiscount(discountModalItem)
    : 0;
  const discountDraftAmount =
    discountModalItem && Number.isFinite(discountDraftValue)
      ? discountAmountFor(
          discountDraft.type,
          Math.max(discountDraftValue, 0),
          discountDraftSubtotalBefore,
        )
      : 0;
  const discountDraftSubtotalAfter = Math.max(
    discountDraftSubtotalBefore - discountDraftAmount,
    0,
  );
  const discountDraftBelowCost =
    Boolean(
      canOpenInventoryDetails &&
        discountModalItem &&
        discountModalItem.costPrice &&
        discountModalItem.costPrice > 0 &&
        discountModalItem.qty > 0 &&
        discountDraftSubtotalAfter / discountModalItem.qty <
          discountModalItem.costPrice,
    );

  function addToCart(product: Product) {
    setSuccessMessage("");
    setLastSaleId("");
    setCheckoutSuccess(null);
    setProofFile(null);
    setProofMessage("");
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
          discountType: "NONE",
          discountValue: 0,
          discountReason: "",
        },
      ];
    });
  }

  function updateItemDiscount(
    id: number,
    discountType: DiscountType,
    discountValue: number,
    discountReason: string,
  ) {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const safeValue = Number.isFinite(discountValue)
          ? Math.max(discountValue, 0)
          : 0;

        return {
          ...item,
          discountType,
          discountValue: discountType === "NONE" ? 0 : safeValue,
          discountReason:
            discountType === "NONE" || safeValue <= 0 ? "" : discountReason.trim(),
        };
      }),
    );
  }

  function openDiscountModal(item: CartItem) {
    setDiscountModalItemId(item.id);
    setDiscountDraft({
      type: item.discountType,
      value: String(item.discountValue),
      reason: item.discountReason,
    });
    setDiscountModalError("");
  }

  function closeDiscountModal() {
    setDiscountModalItemId(null);
    setDiscountModalError("");
  }

  function saveDiscountModal() {
    if (!discountModalItem) {
      return;
    }

    const discountValue = Number(discountDraft.value || 0);

    if (!Number.isFinite(discountValue) || discountValue < 0) {
      setDiscountModalError("Diskon item tidak boleh negatif.");
      return;
    }

    if (discountDraft.type === "PERCENT" && discountValue > 100) {
      setDiscountModalError("Diskon persen tidak boleh lebih dari 100%.");
      return;
    }

    if (
      discountDraft.type === "FIXED" &&
      discountValue > discountDraftSubtotalBefore
    ) {
      setDiscountModalError("Diskon nominal tidak boleh melebihi subtotal item.");
      return;
    }

    const discountAmount = discountAmountFor(
      discountDraft.type,
      discountValue,
      discountDraftSubtotalBefore,
    );

    if (discountAmount > 0 && !discountDraft.reason.trim()) {
      setDiscountModalError("Alasan diskon wajib diisi.");
      return;
    }

    updateItemDiscount(
      discountModalItem.id,
      discountDraft.type,
      discountValue,
      discountDraft.reason,
    );
    closeDiscountModal();
  }

  function validateCartDiscounts() {
    for (const item of cart) {
      const discountAmount = cartLineDiscountAmount(item);
      const subtotalBeforeDiscount = cartLineSubtotalBeforeDiscount(item);

      if (item.discountValue < 0 || discountAmount < 0) {
        return "Diskon item tidak boleh negatif.";
      }

      if (item.discountType === "PERCENT" && item.discountValue > 100) {
        return `Diskon persen ${item.name} tidak boleh lebih dari 100%.`;
      }

      if (item.discountType === "FIXED" && discountAmount > subtotalBeforeDiscount) {
        return `Diskon nominal ${item.name} tidak boleh melebihi subtotal item.`;
      }

      if (discountAmount > 0 && !item.discountReason.trim()) {
        return `Alasan diskon ${item.name} wajib diisi.`;
      }
    }

    return "";
  }

  function validateLoyaltyDraft() {
    if (!eligibleLoyaltyMilestone) {
      return "";
    }

    const value = Number(loyaltyDraft.value || 0);

    if (!loyaltyDraft.note.trim()) {
      return loyaltyDraft.type === "NONE"
        ? "Alasan tidak memberi benefit loyalty wajib diisi."
        : "Catatan benefit loyalty wajib diisi.";
    }

    if (loyaltyDraft.type === "NONE") {
      return "";
    }

    if (!loyaltyMinimumMet) {
      return `Minimal pembelian loyalty ${rupiah(LOYALTY_MIN_PURCHASE_AMOUNT)} belum terpenuhi. Pilih Tidak memberi benefit dengan alasan.`;
    }

    if (!Number.isFinite(value) || value <= 0) {
      return "Nilai benefit loyalty wajib lebih dari 0.";
    }

    if (loyaltyDraft.type === "PERCENT" && value > 100) {
      return "Diskon persen loyalty maksimal 100%.";
    }

    if (loyaltyDraft.type === "FIXED" && value > subtotal) {
      return "Diskon loyalty tidak boleh melebihi subtotal sebelum loyalty.";
    }

    return "";
  }

  function saveLoyaltyModal() {
    const error = validateLoyaltyDraft();

    if (error) {
      if (eligibleLoyaltyMilestone && !loyaltyMinimumMet) {
        setLoyaltyDraft((current) => ({
          ...current,
          type: "NONE",
          value: "0",
          note: current.note || loyaltyMinimumNote,
        }));
      }
      setLoyaltyModalError(error);
      return;
    }

    setLoyaltyConfirmedKey(loyaltyContextKey);
    setLoyaltyModalError("");
    setLoyaltyModalOpen(false);
    setPaymentModalOpen(true);
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
    return paidAmount ? Number(paidAmount) : grandTotal;
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

    const discountError = validateCartDiscounts();

    if (discountError) {
      setErrorMessage(discountError);
      return;
    }

    if (!paymentSettingsReady()) {
      return;
    }

    if (reservedLoyaltyMilestone) {
      setErrorMessage(
        `Milestone loyalty ${reservedLoyaltyMilestone} sedang reserved di transaksi pending customer ini.`,
      );
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    if (eligibleLoyaltyMilestone && !loyaltyConfirmed) {
      setLoyaltyDraft({
        type: "NONE",
        value: "0",
        note: loyaltyMinimumMet ? "" : loyaltyMinimumNote,
      });
      setLoyaltyModalError("");
      setLoyaltyModalOpen(true);
      return;
    }

    const paid = checkoutPaidAmount();

    if (!Number.isFinite(paid) || paid < grandTotal) {
      setErrorMessage("Pembayaran kurang");
      return;
    }

    setPaymentModalOpen(true);
  }

  async function finalizeCheckout() {
    if (loadingCheckout) {
      return;
    }

    const paid = checkoutPaidAmount();
    const discountError = validateCartDiscounts();

    if (discountError) {
      setErrorMessage(discountError);
      return;
    }

    const loyaltyError = validateLoyaltyDraft();

    if (loyaltyError) {
      if (eligibleLoyaltyMilestone && !loyaltyMinimumMet) {
        setLoyaltyDraft((current) => ({
          ...current,
          type: "NONE",
          value: "0",
          note: current.note || loyaltyMinimumNote,
        }));
      }
      setErrorMessage(loyaltyError);
      setLoyaltyModalOpen(true);
      return;
    }

    if (!Number.isFinite(paid) || paid < grandTotal) {
      setErrorMessage("Pembayaran kurang");
      return;
    }

    const selectedCustomerId = customerMatchesInput(
      selectedCustomer,
      customerPhone,
      customerName,
    )
      ? selectedCustomer?.id
      : undefined;
    const hasCustomerInput =
      Boolean(selectedCustomerId) ||
      Boolean(customerName.trim()) ||
      Boolean(customerPhone.trim()) ||
      Boolean(customerAddress.trim());

    setLoadingCheckout(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await request("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          paid_amount: paid,
          payment_method: paymentMethod,
          customer_id: selectedCustomerId,
          loyalty: eligibleLoyaltyMilestone
            ? {
                benefit_type: loyaltyDraft.type,
                benefit_value:
                  loyaltyDraft.type === "NONE" ? 0 : Number(loyaltyDraft.value || 0),
                benefit_note: loyaltyDraft.note,
              }
            : undefined,
          customer: hasCustomerInput
            ? {
                name: customerName,
                phone: customerPhone,
                address: customerAddress,
              }
            : undefined,
          items: cart.map((item) => ({
            product_id: item.id,
            quantity: item.qty,
            discount_type: item.discountType,
            discount_value: item.discountValue,
            discount_reason: item.discountReason,
          })),
        }),
      });

      const responseTransactionStatus =
        response.data?.transaction_status ?? response.data?.status ?? "SUCCESS";
      const responsePaymentStatus = response.data?.payment_status ?? "PAID";
      const saleNumber = response.data?.sale_number ?? "";

      setSuccessMessage(
        responsePaymentStatus === "WAITING_PROOF"
          ? `Transaksi QRIS tersimpan pending - ${saleNumber}`
          : `Transaksi berhasil - ${saleNumber}`,
      );
      setLastSaleId(response.data?.id ?? "");
      setCheckoutSuccess({
        id: response.data?.id ?? "",
        invoiceNumber: saleNumber,
        total: Number(response.data?.grand_total ?? 0),
        paymentMethod: response.data?.payment_method ?? "cash",
        transactionStatus: responseTransactionStatus,
        paymentStatus: responsePaymentStatus,
        paymentProofUrl: response.data?.payment_proof_url ?? null,
      });
      setProofFile(null);
      setProofMessage("");
      setCart([]);
      setPaidAmount("");
      setLoyaltyConfirmedKey("");
      setLoyaltyDraft({
        type: "NONE",
        value: "0",
        note: "",
      });
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
      setSelectedCustomer(null);
      setNormalizedCustomerPhone("");
      setCustomerLookupMessage("");
      closeCustomerSuggestions();
      await fetchProducts();
      await fetchSummary();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Checkout gagal");
    } finally {
      setLoadingCheckout(false);
    }
  }

  async function uploadPaymentProof() {
    if (!checkoutSuccess?.id || uploadingProof) {
      return;
    }

    if (!proofFile) {
      setErrorMessage("Pilih file bukti pembayaran QRIS terlebih dahulu.");
      return;
    }

    setUploadingProof(true);
    setErrorMessage("");
    setProofMessage("");

    try {
      const formData = new FormData();
      formData.set("file", proofFile);

      const response = await request(
        `/api/sales/${checkoutSuccess.id}/payment-proof`,
        {
          method: "POST",
          body: formData,
        },
      );

      setCheckoutSuccess((current) =>
        current
          ? {
              ...current,
              transactionStatus:
                response.data?.transaction_status ?? current.transactionStatus,
              paymentStatus: response.data?.payment_status ?? current.paymentStatus,
              paymentProofUrl:
                response.data?.payment_proof_url ?? current.paymentProofUrl,
            }
          : current,
      );
      setProofFile(null);
      setProofMessage("Bukti QRIS tersimpan. Transaksi sudah SUCCESS / PAID.");
      await fetchSummary();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Gagal upload bukti pembayaran.",
      );
    } finally {
      setUploadingProof(false);
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
    setSelectedCustomer(null);
    closeCustomerSuggestions();
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

  function renderCustomerSuggestions(type: CustomerSuggestionType) {
    if (!customerSuggestionOpen || customerSuggestionType !== type) {
      return null;
    }

    const query =
      type === "phone" ? normalizedPhoneDigits(customerPhone) : customerName.trim();

    if (query.length < 2) {
      return null;
    }

    return (
      <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        {customerSuggestionLoading ? (
          <div className="px-3 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            Mencari customer...
          </div>
        ) : customerSuggestions.length === 0 ? (
          <div className="px-3 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            Tidak ada customer ditemukan
          </div>
        ) : (
          <div className="space-y-1">
            {customerSuggestions.map((customer, index) => (
              <button
                key={customer.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectCustomerSuggestion(customer)}
                className={`w-full rounded-xl px-3 py-3 text-left transition ${
                  index === activeCustomerSuggestionIndex
                    ? "bg-teal-50 text-teal-900 dark:bg-teal-500/10 dark:text-teal-100"
                    : "hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <span className="block truncate text-sm font-bold text-slate-950 dark:text-white">
                  {customer.name}
                </span>
                <span className="mt-1 block truncate text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {customer.phone ?? "-"} - {customer.customerCode || "Customer"}
                </span>
                {customer.address ? (
                  <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">
                    {customer.address}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="w-full min-w-0 pb-4 text-slate-950 dark:text-slate-50">
      <PaymentConfirmationModal
        open={paymentModalOpen}
        paymentMethod={selectedPaymentMethod}
        paymentSettings={paymentSettings}
        total={grandTotal}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white text-slate-950 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 sm:max-h-[86vh] sm:rounded-xl">
            <div className="sticky top-0 z-10 mb-0 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
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

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
                      <div className="min-w-0">
                        <p className="break-all font-bold">{item.invoiceNumber}</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {item.createdAt ? formatDate(item.createdAt) : "-"} •{" "}
                          Customer {item.customer ?? "Walk-in"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Operator {item.cashier ?? "tidak diketahui"} •{" "}
                          {item.itemCount ?? 0} item •{" "}
                          {item.paymentMethod}
                        </p>
                        {item.transactionStatus || item.paymentStatus ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.transactionStatus ? (
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(item.transactionStatus)}`}>
                                {item.transactionStatus}
                              </span>
                            ) : null}
                            {item.paymentStatus ? (
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(item.paymentStatus)}`}>
                                {item.paymentStatus}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <p className="font-bold tabular-nums sm:text-right">
                        {rupiah(item.amount ?? 0)}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-bold">{item.name}</p>
                        <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
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

        <div className="flex flex-wrap items-center justify-end gap-2">
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
              <div className="absolute right-0 top-12 z-20 w-[min(16rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
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
                {checkoutSuccess.paymentStatus === "WAITING_PROOF"
                  ? "QRIS Pending"
                  : "Checkout Success"}
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
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(checkoutSuccess.transactionStatus)}`}>
                  {checkoutSuccess.transactionStatus}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadgeClass(checkoutSuccess.paymentStatus)}`}>
                  {checkoutSuccess.paymentStatus}
                </span>
              </div>
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
          {checkoutSuccess.paymentMethod.toUpperCase().includes("QRIS") &&
          checkoutSuccess.paymentStatus === "WAITING_PROOF" ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                Upload bukti QRIS untuk menyelesaikan transaksi.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) =>
                    setProofFile(event.target.files?.[0] ?? null)
                  }
                  className="min-h-11 w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-900 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-amber-800 dark:border-amber-500/30 dark:bg-slate-950 dark:text-slate-100 dark:file:bg-amber-500/15 dark:file:text-amber-200"
                />
                <button
                  type="button"
                  onClick={uploadPaymentProof}
                  disabled={uploadingProof || !proofFile}
                  className="min-h-11 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadingProof ? "Mengupload..." : "Upload Proof"}
                </button>
              </div>
            </div>
          ) : null}
          {proofMessage ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              {proofMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      {cart.length > 0 ? (
        <a
          href="#pos-cart"
          className="fixed inset-x-4 bottom-20 z-30 flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/10 dark:border-teal-500/30 dark:bg-slate-900 dark:text-slate-100 xl:hidden"
        >
          <span className="min-w-0">
            <span className="block truncate">Keranjang {cartItemCount} item</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Tap untuk checkout
            </span>
          </span>
          <span className="shrink-0 tabular-nums">{rupiah(grandTotal)}</span>
        </a>
      ) : null}

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
                onSearch={handleProductSearch}
                placeholder="Cari produk, SKU, barcode..."
              />

              <label className="relative block">
                <select
                  value={selectedCategory}
                  onChange={(event) => {
                    setSelectedCategory(event.target.value);
                    setProductPage(1);
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

            <ClientPaginationControl
              currentPage={currentProductPage}
              totalItems={filteredProducts.length}
              pageSize={POS_PRODUCT_PAGE_SIZE}
              onPageChange={handleProductPageChange}
              itemLabel="produk"
              className="mt-5 -mx-5 -mb-5 rounded-b-xl"
            />
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
                      setProductPage(1);
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
          <section
            ref={customerAutocompleteRef}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
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
                    onChange={(event) =>
                      handleCustomerManualEdit(event.target.value, "phone")
                    }
                    onFocus={() => {
                      setCustomerSuggestionType("phone");
                      setCustomerSuggestionOpen(true);
                    }}
                    onKeyDown={(event) =>
                      handleCustomerSuggestionKeyDown(event, "phone")
                    }
                    className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="08xxxxxxxxxx"
                  />
                  {renderCustomerSuggestions("phone")}
                  {customerPhone ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerPhone("");
                        setSelectedCustomer(null);
                        setFoundCustomer(null);
                        setNormalizedCustomerPhone("");
                        setCustomerLookupMessage("");
                        closeCustomerSuggestions();
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
                  onChange={(event) =>
                    handleCustomerManualEdit(event.target.value, "name")
                  }
                  onFocus={() => {
                    setCustomerSuggestionType("name");
                    setCustomerSuggestionOpen(true);
                  }}
                  onKeyDown={(event) =>
                    handleCustomerSuggestionKeyDown(event, "name")
                  }
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Nama customer (opsional)"
                />
                <div className="relative">{renderCustomerSuggestions("name")}</div>
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
                  {foundCustomer?.loyalty_progress ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                      <p className="font-semibold">Progress loyalty</p>
                      <p className="mt-1">
                        {foundCustomer.loyalty_progress.valid_transactions}/
                        {foundCustomer.loyalty_progress.next_milestone} transaksi
                        valid menuju benefit.
                      </p>
                      <p className="mt-1 text-xs">
                        S&K benefit: minimal pembelian{" "}
                        {rupiah(LOYALTY_MIN_PURCHASE_AMOUNT)} setelah diskon item.
                      </p>
                      {foundCustomer.loyalty_progress.eligible_milestone ? (
                        foundCustomer.loyalty_progress.reserved_milestones.includes(
                          foundCustomer.loyalty_progress.eligible_milestone,
                        ) ? (
                          <p className="mt-1 font-semibold">
                            Milestone {foundCustomer.loyalty_progress.eligible_milestone} sedang reserved di transaksi pending.
                          </p>
                        ) : (
                          <p className="mt-1 font-semibold">
                            Transaksi ini mencapai milestone {foundCustomer.loyalty_progress.eligible_milestone}.
                          </p>
                        )
                      ) : (
                        <p className="mt-1">
                          Sisa {foundCustomer.loyalty_progress.remaining_to_next} transaksi.
                        </p>
                      )}
                      {eligibleLoyaltyMilestone && !loyaltyMinimumMet ? (
                        <p className="mt-1 font-semibold text-amber-800 dark:text-amber-100">
                          Subtotal saat ini belum memenuhi minimal pembelian.
                          Kurang {rupiah(loyaltyMinimumShortfall)}.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section id="pos-cart" className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                      <p className="line-clamp-2 break-words font-semibold text-slate-950 dark:text-slate-50">
                        {item.name}
                      </p>
                      <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                        {item.sku}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold tabular-nums text-slate-950 dark:text-slate-50">
                        {rupiah(cartLineTotal(item))}
                      </p>
                      {cartLineDiscountAmount(item) > 0 ? (
                        <p className="text-xs tabular-nums text-rose-600 dark:text-rose-300">
                          -{rupiah(cartLineDiscountAmount(item))}
                        </p>
                      ) : null}
                    </div>
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

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Diskon Item
                        </p>
                        <p className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {cartLineDiscountLabel(item)}
                        </p>
                        {cartLineDiscountAmount(item) > 0 &&
                        item.discountReason ? (
                          <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">
                            {item.discountReason}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => openDiscountModal(item)}
                        className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-teal-300 px-3 text-xs font-bold text-teal-700 transition hover:bg-teal-50 dark:border-teal-500/40 dark:text-teal-200 dark:hover:bg-teal-500/10"
                      >
                        Edit Diskon
                      </button>
                    </div>
                    {canOpenInventoryDetails &&
                    item.costPrice &&
                    item.costPrice > 0 &&
                    item.qty > 0 &&
                    cartLineTotal(item) / item.qty < item.costPrice ? (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                        Harga efektif setelah diskon berada di bawah HPP.
                      </p>
                    ) : null}
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
              {totalItemDiscount > 0 ? (
                <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm dark:border-rose-500/20 dark:bg-rose-500/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-600 dark:text-slate-300">
                      Subtotal sebelum diskon
                    </span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {rupiah(subtotalBeforeDiscount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-rose-700 dark:text-rose-200">
                      Total diskon item
                    </span>
                    <span className="font-semibold tabular-nums text-rose-700 dark:text-rose-200">
                      -{rupiah(totalItemDiscount)}
                    </span>
                  </div>
                </div>
              ) : null}
              {eligibleLoyaltyMilestone && loyaltyConfirmed ? (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-amber-800 dark:text-amber-100">
                      Milestone loyalty
                    </span>
                    <span className="font-semibold tabular-nums text-amber-900 dark:text-amber-100">
                      #{eligibleLoyaltyMilestone}
                    </span>
                  </div>
                  {loyaltyDiscountAmount > 0 ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-rose-700 dark:text-rose-200">
                        Diskon loyalty
                      </span>
                      <span className="font-semibold tabular-nums text-rose-700 dark:text-rose-200">
                        -{rupiah(loyaltyDiscountAmount)}
                      </span>
                    </div>
                  ) : (
                    <p className="text-amber-800 dark:text-amber-100">
                      Benefit dilewati: {loyaltyDraft.note}
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-3 border-t border-amber-200 pt-2 dark:border-amber-500/20">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Grand total
                    </span>
                    <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                      {rupiah(grandTotal)}
                    </span>
                  </div>
                </div>
              ) : null}

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
                  placeholder={String(grandTotal)}
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
      <Dialog
        open={loyaltyModalOpen}
        onOpenChange={(open) => {
          setLoyaltyModalOpen(open);
          if (!open) {
            setLoyaltyModalError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Benefit Loyalty</DialogTitle>
            <DialogDescription>
              {foundCustomer?.name ?? "Customer"} mencapai transaksi ke-
              {eligibleLoyaltyMilestone ?? "-"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-semibold">{foundCustomer?.customerCode}</p>
              <p className="mt-1">
                Transaksi valid sebelumnya:{" "}
                {loyaltyProgress?.valid_transactions ?? 0}
              </p>
              <p className="mt-1">
                Milestone saat ini: {eligibleLoyaltyMilestone ?? "-"}
              </p>
              <p className="mt-1">
                Minimal pembelian loyalty:{" "}
                {rupiah(LOYALTY_MIN_PURCHASE_AMOUNT)}
              </p>
              <p className="mt-1">
                Subtotal saat ini: {rupiah(subtotal)}
              </p>
              <p className="mt-1 font-semibold">
                Status S&K:{" "}
                {loyaltyMinimumStatus === "memenuhi"
                  ? "memenuhi minimal pembelian"
                  : `belum memenuhi, kurang ${rupiah(loyaltyMinimumShortfall)}`}
              </p>
            </div>

            {!loyaltyMinimumMet ? (
              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-100">
                Milestone tercapai, tetapi benefit diskon belum bisa diberikan
                karena subtotal setelah diskon item belum mencapai minimal pembelian.
                Pilih Tidak memberi benefit dan isi alasan S&K.
              </div>
            ) : null}

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Benefit
              </span>
              <select
                value={loyaltyDraft.type}
                onChange={(event) => {
                  const nextType = event.target.value as LoyaltyBenefitType;
                  setLoyaltyDraft((current) => ({
                    ...current,
                    type: nextType,
                    value: nextType === "NONE" ? "0" : current.value,
                  }));
                  setLoyaltyModalError("");
                }}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="NONE">Tidak memberi benefit</option>
                <option value="FIXED" disabled={!loyaltyMinimumMet}>
                  Diskon Rupiah
                </option>
                <option value="PERCENT" disabled={!loyaltyMinimumMet}>
                  Diskon Persen
                </option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Nilai Benefit
              </span>
              <input
                type="number"
                min="0"
                max={loyaltyDraft.type === "PERCENT" ? 100 : undefined}
                disabled={loyaltyDraft.type === "NONE" || !loyaltyMinimumMet}
                value={loyaltyDraft.value}
                onChange={(event) => {
                  setLoyaltyDraft((current) => ({
                    ...current,
                    value: event.target.value,
                  }));
                  setLoyaltyModalError("");
                }}
                placeholder={loyaltyDraft.type === "PERCENT" ? "0 - 100" : "0"}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Catatan / Alasan S&K
              </span>
              <textarea
                value={loyaltyDraft.note}
                onChange={(event) => {
                  setLoyaltyDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }));
                  setLoyaltyModalError("");
                }}
                rows={3}
                placeholder={
                  loyaltyDraft.type === "NONE"
                    ? "Wajib diisi jika benefit dilewati"
                    : "Wajib diisi sesuai S&K benefit"
                }
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Subtotal sebelum loyalty
                </span>
                <span className="font-semibold tabular-nums">
                  {rupiah(subtotal)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-rose-700 dark:text-rose-200">
                  Diskon loyalty
                </span>
                <span className="font-semibold tabular-nums text-rose-700 dark:text-rose-200">
                  -{rupiah(
                    loyaltyPreviewDiscountAmount,
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Grand total
                </span>
                <span className="font-bold tabular-nums">
                  {rupiah(
                    Math.max(subtotal - loyaltyPreviewDiscountAmount, 0),
                  )}
                </span>
              </div>
            </div>

            {loyaltyModalError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {loyaltyModalError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={saveLoyaltyModal}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              Simpan Benefit Loyalty
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={discountModalItem !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeDiscountModal();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Diskon</DialogTitle>
            <DialogDescription>
              {discountModalItem?.name ?? "Item keranjang"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tipe Diskon
              </span>
              <select
                value={discountDraft.type}
                onChange={(event) => {
                  const nextType = event.target.value as DiscountType;
                  setDiscountDraft((current) => ({
                    ...current,
                    type: nextType,
                    value: nextType === "NONE" ? "0" : current.value,
                    reason: nextType === "NONE" ? "" : current.reason,
                  }));
                  setDiscountModalError("");
                }}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="NONE">Tanpa Diskon</option>
                <option value="FIXED">Nominal Rupiah</option>
                <option value="PERCENT">Persen %</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Nilai Diskon
              </span>
              <input
                type="number"
                min="0"
                max={discountDraft.type === "PERCENT" ? 100 : undefined}
                disabled={discountDraft.type === "NONE"}
                value={discountDraft.value}
                onChange={(event) => {
                  setDiscountDraft((current) => ({
                    ...current,
                    value: event.target.value,
                  }));
                  setDiscountModalError("");
                }}
                placeholder={discountDraft.type === "PERCENT" ? "0 - 100" : "0"}
                className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Alasan Diskon
              </span>
              <textarea
                value={discountDraft.reason}
                disabled={discountDraftAmount <= 0}
                onChange={(event) => {
                  setDiscountDraft((current) => ({
                    ...current,
                    reason: event.target.value,
                  }));
                  setDiscountModalError("");
                }}
                rows={3}
                placeholder={
                  discountDraftAmount > 0
                    ? "Wajib diisi jika ada diskon"
                    : "Kosong jika tanpa diskon"
                }
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:disabled:bg-slate-900"
              />
            </label>

            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500 dark:text-slate-400">
                  Subtotal sebelum diskon
                </span>
                <span className="font-semibold tabular-nums">
                  {rupiah(discountDraftSubtotalBefore)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-rose-700 dark:text-rose-200">
                  Total diskon
                </span>
                <span className="font-semibold tabular-nums text-rose-700 dark:text-rose-200">
                  -{rupiah(discountDraftAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-2 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  Subtotal setelah diskon
                </span>
                <span className="font-bold tabular-nums">
                  {rupiah(discountDraftSubtotalAfter)}
                </span>
              </div>
            </div>

            {discountDraftBelowCost ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                Harga efektif setelah diskon berada di bawah HPP.
              </p>
            ) : null}

            {discountModalError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {discountModalError}
              </p>
            ) : null}

            <button
              type="button"
              onClick={saveDiscountModal}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
            >
              Simpan Diskon
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
