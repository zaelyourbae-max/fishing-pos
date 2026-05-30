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
import type { ChangeEvent, KeyboardEvent, ReactNode } from "react";
import SaleMessageActions from "@/components/message-actions/sale-message-actions";
import PendingExpiryCountdown from "@/components/sales/pending-expiry-countdown";
import PaymentConfirmationModal from "@/components/pos/payment-confirmation-modal";
import ThemeToggle from "@/components/layout/theme-toggle";
import LocalLiveSearchInput from "@/components/search/local-live-search-input";
import ClientPaginationControl from "@/components/ui/client-pagination-control";
import { useGlobalInteractionCleanup } from "@/lib/global-interaction-state";
import { formatDateTimeID } from "@/lib/date-format";
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
  brand?: string | null;
  type?: string | null;
  size?: string | null;
  variant?: string | null;
  rackLocation?: string | null;
  description?: string | null;
  category: string;
  imageUrl?: string | null;
  price: number;
  costPrice?: number | null;
  stock: number;
  unit: string;
};

type ApiProduct = {
  id: number;
  name: string;
  sku: string | null;
  barcode?: string | null;
  brand?: string | null;
  type?: string | null;
  size?: string | null;
  variant?: string | null;
  rackLocation?: string | null;
  rack_location?: string | null;
  description?: string | null;
  category: string | { name?: string | null } | null;
  image_url?: string | null;
  cost_price?: number | string;
  selling_price: number | string;
  current_stock: number | string;
  unit?: string | null;
};

type DiscountType = "NONE" | "FIXED" | "PERCENT";

type CartItem = Product & {
  qty: number;
  qtyInput: string;
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
  expiredAt?: string | null;
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
const DEFAULT_POS_PRODUCT_PAGE_SIZE = 6;
const MOBILE_CART_PREVIEW_LIMIT = 3;
const POS_DRAFT_KEY_PREFIX = "fishing_pos_draft_v1";
const POS_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type PosDraftCartItem = {
  productId: number;
  qty: number;
  qtyInput: string;
  discountType: DiscountType;
  discountValue: number;
  discountReason: string;
};

type PosDraft = {
  version: 1;
  updatedAt: number;
  cart: PosDraftCartItem[];
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  paymentMethod: string;
  paidAmount: string;
};

function resolvePosProductPageSize() {
  if (typeof window === "undefined") {
    return DEFAULT_POS_PRODUCT_PAGE_SIZE;
  }

  if (window.matchMedia("(min-width: 1536px)").matches) {
    return 8;
  }

  if (window.matchMedia("(min-width: 1024px)").matches) {
    return 6;
  }

  return 4;
}

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function normalizeRupiahIntegerInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  return digitsOnly.replace(/^0+(?=\d)/, "");
}

function formatRupiahIntegerInput(value: string) {
  const normalizedValue = normalizeRupiahIntegerInput(value);

  return normalizedValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseRupiahIntegerInput(value: string) {
  const normalizedValue = normalizeRupiahIntegerInput(value);

  if (!normalizedValue) {
    return 0;
  }

  const amount = Number.parseInt(normalizedValue, 10);

  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

function formattedRupiahCaretPosition(formattedValue: string, digitCount: number) {
  if (digitCount <= 0) {
    return 0;
  }

  let seenDigits = 0;

  for (let index = 0; index < formattedValue.length; index += 1) {
    const char = formattedValue[index];

    if (char >= "0" && char <= "9") {
      seenDigits += 1;
    }

    if (seenDigits === digitCount) {
      return index + 1;
    }
  }

  return formattedValue.length;
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
  return formatDateTimeID(value);
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
    return formatCategoryLabel(category);
  }

  return formatCategoryLabel(category.name ?? "Tanpa kategori");
}

function normalizeCategoryText(category: string) {
  return category.trim().replace(/\s+/g, " ");
}

function categoryFilterKey(category: string) {
  return normalizeCategoryText(category).toLocaleLowerCase("id-ID");
}

function formatCategoryLabel(category: string) {
  const normalized = normalizeCategoryText(category);

  if (!normalized) {
    return "Tanpa kategori";
  }

  return normalized
    .split(" ")
    .map((word) => {
      const lower = word.toLocaleLowerCase("id-ID");

      if (lower === "pe") {
        return "PE";
      }

      if (word === word.toLocaleUpperCase("id-ID") && /[A-Z]/i.test(word)) {
        return word;
      }

      return lower.charAt(0).toLocaleUpperCase("id-ID") + lower.slice(1);
    })
    .join(" ");
}

function compactProductValues(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(" / ");
}

function productCompactMeta(product: Product) {
  return compactProductValues([
    product.brand,
    product.type,
    product.size,
    product.variant,
  ]);
}

function productCodeLabel(product: Product) {
  const sku = productSkuLabel(product);

  if (sku) {
    return sku;
  }

  return product.barcode.trim();
}

function productSkuLabel(product: Product) {
  const sku = product.sku.trim();

  return sku && sku !== "-" ? sku : "";
}

function productSkuBarcodeLabel(product: Product) {
  return compactProductValues([productSkuLabel(product), product.barcode]);
}

function ProductDetailField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-bold text-slate-950 dark:text-slate-50">
        {value}
      </div>
    </div>
  );
}

function readStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(USER_KEY);

  return value ? (JSON.parse(value) as UserPayload) : null;
}

function userDraftKey(user: UserPayload | null) {
  const rawKey = user?.email || user?.name || "guest";
  const scopedKey = rawKey.trim().toLocaleLowerCase("id-ID") || "guest";

  return `${POS_DRAFT_KEY_PREFIX}:${scopedKey}`;
}

function readPosDraft(key: string): PosDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawDraft = window.localStorage.getItem(key);

    if (!rawDraft) {
      return null;
    }

    const draft = JSON.parse(rawDraft) as Partial<PosDraft>;

    if (
      draft.version !== 1 ||
      typeof draft.updatedAt !== "number" ||
      Date.now() - draft.updatedAt > POS_DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      version: 1,
      updatedAt: draft.updatedAt,
      cart: Array.isArray(draft.cart) ? draft.cart : [],
      customerName: stringValue(draft.customerName),
      customerPhone: stringValue(draft.customerPhone),
      customerAddress: stringValue(draft.customerAddress),
      paymentMethod: stringValue(draft.paymentMethod),
      paidAmount: normalizeRupiahIntegerInput(stringValue(draft.paidAmount)),
    };
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function clearPosDraft(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}

function writePosDraft(key: string, draft: Omit<PosDraft, "version" | "updatedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  if (draft.cart.length === 0) {
    clearPosDraft(key);
    return;
  }

  window.localStorage.setItem(
    key,
    JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      ...draft,
    } satisfies PosDraft),
  );
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

function ProductThumb({
  product,
  className = "h-12 w-12 rounded-xl",
}: {
  product: Product;
  className?: string;
}) {
  const baseClassName =
    "flex shrink-0 items-center justify-center bg-slate-50";

  if (product.imageUrl) {
    return (
      <div
        className={`${baseClassName} bg-contain bg-center bg-no-repeat ${className}`}
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
    <div
      className={`flex shrink-0 items-center justify-center border border-teal-100 bg-teal-50 text-teal-700 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-300 ${className}`}
    >
      {categoryIconElement(product.category, "h-6 w-6")}
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
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [productSearchFocused, setProductSearchFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(
    DEFAULT_POS_PRODUCT_PAGE_SIZE,
  );
  const [productView, setProductView] = useState<"grid" | "list">("grid");
  const [productDetail, setProductDetail] = useState<Product | null>(null);
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
  const mobileCustomerAutocompleteRef = useRef<HTMLDetailsElement | null>(null);
  const customerNameInputRef = useRef<HTMLInputElement | null>(null);
  const paidAmountInputRef = useRef<HTMLInputElement | null>(null);
  const mobilePaymentSectionRef = useRef<HTMLElement | null>(null);
  const mobileCartScrollRef = useRef<HTMLDivElement | null>(null);
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
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [mobilePaymentSectionVisible, setMobilePaymentSectionVisible] =
    useState(false);
  const [mobileCartItemsExpanded, setMobileCartItemsExpanded] = useState(false);
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
  const [posDraftHydrated, setPosDraftHydrated] = useState(false);
  const restoredDraftKeyRef = useRef("");
  const [loyaltyModalOpen, setLoyaltyModalOpen] = useState(false);
  const [loyaltyModalError, setLoyaltyModalError] = useState("");
  const [loyaltyConfirmedKey, setLoyaltyConfirmedKey] = useState("");
  const [loyaltyDraft, setLoyaltyDraft] = useState<LoyaltyDraft>({
    type: "NONE",
    value: "0",
    note: "",
  });
  const selectedPaymentMethod = paymentMethods.find(
    (method) => method.code === paymentMethod,
  );
  const mobileCartSheetOpen = mobileCartOpen && cart.length > 0;
  const visibleMobileCartItems = mobileCartItemsExpanded
    ? cart
    : cart.slice(0, MOBILE_CART_PREVIEW_LIMIT);
  const hiddenMobileCartItemCount = Math.max(
    cart.length - MOBILE_CART_PREVIEW_LIMIT,
    0,
  );
  const modalOverlayOpen =
    mobileCartSheetOpen ||
    (paymentModalOpen && Boolean(selectedPaymentMethod)) ||
    summaryDetail !== null ||
    productDetail !== null ||
    loyaltyModalOpen ||
    discountModalItemId !== null;
  const posDraftKey = useMemo(() => userDraftKey(user), [user]);

  useGlobalInteractionCleanup(modalOverlayOpen);

  useEffect(() => {
    if (!mobileCartSheetOpen) {
      return;
    }

    const root = mobileCartScrollRef.current;
    const target = mobilePaymentSectionRef.current;

    if (!root || !target || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setMobilePaymentSectionVisible(
          entry.isIntersecting && entry.intersectionRatio >= 0.35,
        );
      },
      {
        root,
        threshold: [0, 0.35, 0.6],
      },
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [mobileCartSheetOpen]);

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
        brand: product.brand?.trim() || null,
        type: product.type?.trim() || null,
        size: product.size?.trim() || null,
        variant: product.variant?.trim() || null,
        rackLocation:
          product.rackLocation?.trim() || product.rack_location?.trim() || null,
        description: product.description?.trim() || null,
        category: readCategory(product.category),
        imageUrl: product.image_url ?? null,
        price: Number(product.selling_price),
        costPrice:
          product.cost_price === undefined ? null : Number(product.cost_price),
        stock: Number(product.current_stock),
        unit: product.unit?.trim() || "pcs",
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
      setProductsLoaded(true);
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
        expiredAt: sale.expired_at ?? null,
      });
      setLastSaleId(String(sale.id ?? ""));
      setSuccessMessage(
        `Transaksi manual pending masih menunggu bukti - ${
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

    if (
      event.key === "Enter" &&
      type === "phone" &&
      (!customerSuggestionOpen || customerSuggestionType !== type)
    ) {
      event.preventDefault();
      closeCustomerSuggestions();
      const customerForm = event.currentTarget.closest("[data-customer-form]");
      const customerNameInput =
        customerForm?.querySelector<HTMLInputElement>(
          "[data-customer-name-input]",
        ) ?? customerNameInputRef.current;
      customerNameInput?.focus();
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
      return;
    }

    if (event.key === "Enter" && type === "phone") {
      event.preventDefault();
      closeCustomerSuggestions();
      const customerForm = event.currentTarget.closest("[data-customer-form]");
      const customerNameInput =
        customerForm?.querySelector<HTMLInputElement>(
          "[data-customer-name-input]",
        ) ?? customerNameInputRef.current;
      customerNameInput?.focus();
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
    if (!productsLoaded || restoredDraftKeyRef.current === posDraftKey) {
      return;
    }

    restoredDraftKeyRef.current = posDraftKey;

    const restoreTimer = window.setTimeout(() => {
      const draft = readPosDraft(posDraftKey);

      setPosDraftHydrated(true);

      if (!draft) {
        return;
      }

      const productById = new Map(
        products.map((product) => [product.id, product]),
      );
      const restoredCart: CartItem[] = [];
      const warnings: string[] = [];

      for (const draftItem of draft.cart) {
        const productId = Number(draftItem.productId);
        const product = Number.isInteger(productId)
          ? productById.get(productId)
          : undefined;

        if (!product || product.stock <= 0) {
          warnings.push("beberapa item tidak tersedia lagi");
          continue;
        }

        const draftQty = Number(draftItem.qty);
        const safeQty =
          Number.isInteger(draftQty) && draftQty > 0
            ? Math.min(draftQty, product.stock)
            : 1;

        if (safeQty !== draftQty) {
          warnings.push(`${product.name} disesuaikan ke stok ${safeQty}`);
        }

        const discountType: DiscountType =
          draftItem.discountType === "FIXED" ||
          draftItem.discountType === "PERCENT"
            ? draftItem.discountType
            : "NONE";
        const discountValue = Number(draftItem.discountValue);
        const safeDiscountValue =
          discountType === "NONE" || !Number.isFinite(discountValue)
            ? 0
            : Math.max(discountValue, 0);

        restoredCart.push({
          ...product,
          qty: safeQty,
          qtyInput: String(safeQty),
          discountType,
          discountValue: safeDiscountValue,
          discountReason:
            discountType === "NONE" || safeDiscountValue <= 0
              ? ""
              : stringValue(draftItem.discountReason).trim(),
        });
      }

      setCart(restoredCart);
      setCustomerName(draft.customerName);
      setCustomerPhone(draft.customerPhone);
      setCustomerAddress(draft.customerAddress);
      setPaidAmount(draft.paidAmount);

      if (paymentMethods.some((method) => method.code === draft.paymentMethod)) {
        setPaymentMethod(draft.paymentMethod);
      }

      if (warnings.length > 0) {
        setErrorMessage(
          `Draft POS dipulihkan dengan penyesuaian: ${Array.from(
            new Set(warnings),
          ).join(", ")}.`,
        );
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [paymentMethods, posDraftKey, products, productsLoaded]);

  useEffect(() => {
    if (!posDraftHydrated) {
      return;
    }

    writePosDraft(posDraftKey, {
      cart: cart.map((item) => ({
        productId: item.id,
        qty: item.qty,
        qtyInput: item.qtyInput,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountReason: item.discountReason,
      })),
      customerName,
      customerPhone,
      customerAddress,
      paymentMethod,
      paidAmount,
    });
  }, [
    cart,
    customerAddress,
    customerName,
    customerPhone,
    paidAmount,
    paymentMethod,
    posDraftHydrated,
    posDraftKey,
  ]);

  useEffect(() => {
    function updateProductPageSize() {
      setProductPageSize(resolvePosProductPageSize());
    }

    updateProductPageSize();
    window.addEventListener("resize", updateProductPageSize);

    return () => window.removeEventListener("resize", updateProductPageSize);
  }, []);

  useEffect(() => {
    if (!customerSuggestionOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const customerSuggestionContainers = [
        customerAutocompleteRef.current,
        mobileCustomerAutocompleteRef.current,
      ].filter(Boolean);

      if (
        customerSuggestionContainers.length > 0 &&
        customerSuggestionContainers.every(
          (container) => !container?.contains(target),
        )
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
  const cartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.qty, 0);
  }, [cart]);
  const categoryOptions = useMemo(() => {
    const options = new Map<string, { key: string; label: string }>();

    for (const product of products) {
      const label = formatCategoryLabel(product.category);
      const key = categoryFilterKey(label);

      if (!options.has(key)) {
        options.set(key, { key, label });
      }
    }

    return Array.from(options.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "id-ID"),
    );
  }, [products]);
  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatched =
        selectedCategory === "Semua" ||
        categoryFilterKey(product.category) === selectedCategory;
      const name = product.name?.toLowerCase() || "";
      const sku = product.sku?.toLowerCase() || "";
      const barcode = product.barcode?.toLowerCase() || "";
      const brand = product.brand?.toLowerCase() || "";
      const type = product.type?.toLowerCase() || "";
      const size = product.size?.toLowerCase() || "";
      const variant = product.variant?.toLowerCase() || "";
      const category = categoryFilterKey(product.category);
      const keywordMatched =
        !keyword ||
        name.includes(keyword) ||
        sku.includes(keyword) ||
        barcode.includes(keyword) ||
        brand.includes(keyword) ||
        type.includes(keyword) ||
        size.includes(keyword) ||
        variant.includes(keyword) ||
        category.includes(keyword);

      return categoryMatched && keywordMatched;
    });
  }, [products, search, selectedCategory]);

  const productPageCount = Math.max(
    1,
    Math.ceil(filteredProducts.length / productPageSize),
  );
  const currentProductPage = Math.min(productPage, productPageCount);
  const visibleProducts = useMemo(
    () =>
      filteredProducts.slice(
        (currentProductPage - 1) * productPageSize,
        currentProductPage * productPageSize,
      ),
    [currentProductPage, filteredProducts, productPageSize],
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
                qtyInput: String(Math.min(item.qty + 1, product.stock)),
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          ...product,
          qty: 1,
          qtyInput: "1",
          discountType: "NONE",
          discountValue: 0,
          discountReason: "",
        },
      ];
    });
  }

  function addProductDetailToCart(product: Product) {
    addToCart(product);

    if (product.stock > 0) {
      setProductDetail(null);
    }
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

  function validateCartQuantities() {
    for (const item of cart) {
      const rawQty = item.qtyInput.trim();
      const qty = Number(rawQty);

      if (!rawQty) {
        return `Qty ${item.name} wajib diisi.`;
      }

      if (!Number.isInteger(qty) || qty <= 0) {
        return `Qty ${item.name} harus angka bulat lebih dari 0.`;
      }

      if (qty > item.stock) {
        return `Qty ${item.name} melebihi stok. Tersedia ${item.stock} ${item.unit}.`;
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
    setMobileCartOpen(false);
    setPaymentModalOpen(true);
  }

  function increaseQty(id: number) {
    setCart((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              qty: Math.min(item.qty + 1, item.stock),
              qtyInput: String(Math.min(item.qty + 1, item.stock)),
            }
          : item,
      ),
    );
  }

  function decreaseQty(id: number) {
    if (cart.length === 1 && cart[0]?.id === id && cart[0].qty <= 1) {
      setMobileCartOpen(false);
    }

    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? {
                ...item,
                qty: item.qty - 1,
                qtyInput: String(item.qty - 1),
              }
            : item,
        )
        .filter((item) => item.qty > 0),
    );
  }

  function removeCartItem(id: number) {
    if (cart.length === 1 && cart[0]?.id === id) {
      setMobileCartOpen(false);
    }

    setCart((prev) => prev.filter((item) => item.id !== id));
  }

  function applyManualQty(id: number, value: string, showError = false) {
    const trimmedValue = value.trim();
    const parsedQty = Number(trimmedValue);
    let nextError = "";

    setCart((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (!trimmedValue) {
          nextError = `Qty ${item.name} wajib diisi.`;
          return {
            ...item,
            qtyInput: value,
          };
        }

        if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
          nextError = `Qty ${item.name} harus angka bulat lebih dari 0.`;
          return {
            ...item,
            qtyInput: value,
          };
        }

        if (parsedQty > item.stock) {
          nextError = `Qty ${item.name} melebihi stok. Tersedia ${item.stock} ${item.unit}.`;
          return {
            ...item,
            qtyInput: value,
          };
        }

        return {
          ...item,
          qty: parsedQty,
          qtyInput: String(parsedQty),
        };
      }),
    );

    if (showError && nextError) {
      setErrorMessage(nextError);
    } else if (!nextError) {
      setErrorMessage("");
    }
  }

  function checkoutPaidAmount() {
    return paidAmount ? parseRupiahIntegerInput(paidAmount) : grandTotal;
  }

  function handlePaidAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const rawValue = event.target.value;
    const selectionStart = input.selectionStart ?? rawValue.length;
    const digitsBeforeCaret = normalizeRupiahIntegerInput(
      rawValue.slice(0, selectionStart),
    ).length;
    const nextPaidAmount = normalizeRupiahIntegerInput(rawValue);

    setPaidAmount(nextPaidAmount);

    window.requestAnimationFrame(() => {
      if (document.activeElement !== input) {
        return;
      }

      const formattedValue = formatRupiahIntegerInput(nextPaidAmount);
      const caretPosition = formattedRupiahCaretPosition(
        formattedValue,
        digitsBeforeCaret,
      );

      input.setSelectionRange(caretPosition, caretPosition);
    });
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

    const qtyError = validateCartQuantities();

    if (qtyError) {
      setErrorMessage(qtyError);
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
      setMobileCartOpen(false);
      setLoyaltyModalOpen(true);
      return;
    }

    const paid = checkoutPaidAmount();

    if (!Number.isFinite(paid) || paid < grandTotal) {
      setErrorMessage("Pembayaran kurang");
      return;
    }

    setMobileCartOpen(false);
    setPaymentModalOpen(true);
  }

  function scrollToMobilePaymentSection() {
    setMobilePaymentSectionVisible(true);
    mobilePaymentSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    mobilePaymentSectionRef.current?.focus({
      preventScroll: true,
    });
  }

  async function finalizeCheckout() {
    if (loadingCheckout) {
      return;
    }

    const paid = checkoutPaidAmount();
    const qtyError = validateCartQuantities();
    const discountError = validateCartDiscounts();

    if (qtyError) {
      setErrorMessage(qtyError);
      return;
    }

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
          ? `Transaksi manual tersimpan pending - ${saleNumber}`
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
        expiredAt: response.data?.expired_at ?? null,
      });
      setProofFile(null);
      setProofMessage("");
      clearPosDraft(posDraftKey);
      setCart([]);
      setPaidAmount("");
      setLoyaltyConfirmedKey("");
      setLoyaltyDraft({
        type: "NONE",
        value: "0",
        note: "",
      });
      setPaymentModalOpen(false);
      setMobileCartOpen(false);
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
              expiredAt: null,
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
    clearPosDraft(posDraftKey);
    restoredDraftKeyRef.current = "";
    setPosDraftHydrated(false);
    setToken("");
    setUser(null);
    setProducts([]);
    setProductsLoaded(false);
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
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setSelectedCustomer(null);
    setFoundCustomer(null);
    setNormalizedCustomerPhone("");
    setCustomerLookupMessage("");
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

    if (
      type === "phone" &&
      !customerSuggestionLoading &&
      customerSuggestions.length === 0
    ) {
      return null;
    }

    return (
      <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        {customerSuggestionLoading ? (
          <div className="px-3 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            Mencari customer...
          </div>
        ) : customerSuggestions.length === 0 && type === "name" ? (
          <div className="px-3 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            Tidak ada customer ditemukan
          </div>
        ) : customerSuggestions.length === 0 ? null : (
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
    <main className="w-full min-w-0 pb-24 text-slate-950 dark:text-slate-50 sm:pb-28 xl:pb-6">
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

      <Dialog
        open={Boolean(productDetail)}
        onOpenChange={(open) => {
          if (!open) {
            setProductDetail(null);
          }
        }}
      >
        {productDetail ? (
          <DialogContent className="bottom-0 left-0 right-0 top-auto max-h-[88dvh] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-b-none rounded-t-3xl p-0 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
            <div className="max-h-[88dvh] overflow-y-auto overscroll-contain p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] sm:max-h-[calc(100dvh-2rem)] sm:p-6">
              <DialogHeader className="pr-10">
                <DialogTitle className="text-xl font-extrabold leading-snug text-slate-950 dark:text-slate-50">
                  {productDetail.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detail produk {productDetail.name}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-5 flex items-start gap-4">
                <ProductThumb
                  product={productDetail}
                  className="h-20 w-20 rounded-2xl sm:h-24 sm:w-24"
                />
                <div className="min-w-0 flex-1">
                  <p className="metric-value text-2xl leading-tight">
                    {rupiah(productDetail.price)}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    / {productDetail.unit}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {formatCategoryLabel(productDetail.category)}
                    </span>
                    <span
                      className={
                        productDetail.stock <= 0
                          ? "rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                          : "rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-200"
                      }
                    >
                      Stok {productDetail.stock} {productDetail.unit}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ProductDetailField
                  label="SKU / Barcode"
                  value={productSkuBarcodeLabel(productDetail) || "-"}
                />
                <ProductDetailField
                  label="Kategori"
                  value={formatCategoryLabel(productDetail.category)}
                />
                <ProductDetailField
                  label="Produk"
                  value={productCompactMeta(productDetail) || "-"}
                />
                <ProductDetailField
                  label="Satuan"
                  value={productDetail.unit}
                />
                <ProductDetailField
                  label="Harga"
                  value={`${rupiah(productDetail.price)} / ${productDetail.unit}`}
                />
                <ProductDetailField
                  label="Stok"
                  value={`${productDetail.stock} ${productDetail.unit}`}
                />
                {productDetail.rackLocation ? (
                  <ProductDetailField
                    label="Lokasi Rak"
                    value={productDetail.rackLocation}
                  />
                ) : null}
              </div>

              {productDetail.description ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Deskripsi
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {productDetail.description}
                  </p>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => addProductDetailToCart(productDetail)}
                disabled={productDetail.stock <= 0}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm shadow-teal-600/20 transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
              >
                {productDetail.stock <= 0
                  ? "Stok Habis"
                  : "Tambah ke keranjang"}
              </button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {summaryDetail ? (
        <div
          data-mobile-blocking-overlay
          className="fixed inset-0 z-50 flex items-end justify-center overscroll-contain bg-slate-950/50 p-0 sm:items-center sm:p-4"
        >
          <div data-mobile-sheet className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white text-slate-950 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-50 sm:max-h-[86vh] sm:rounded-xl">
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

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 [-webkit-overflow-scrolling:touch]">
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

      <header className="mb-3 flex flex-col gap-2 px-1 py-0.5 sm:mb-5 sm:gap-3 sm:py-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-sans text-xl font-bold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
            Fishing POS
          </h1>
          <p className="mt-1 hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
            Sistem kasir toko pancing
          </p>
        </div>

        <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
          <ThemeToggle />
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800"
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
            className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
        <div
          className={`mb-5 rounded-2xl border p-4 shadow-sm ${
            checkoutSuccess.paymentStatus === "WAITING_PROOF"
              ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
              : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10"
          }`}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {checkoutSuccess.paymentStatus === "WAITING_PROOF"
                  ? "Transaksi pending - stok sudah direserve"
                  : "Transaksi selesai"}
              </p>
              <h2 className="metric-value mt-1 break-all text-2xl">
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
              {checkoutSuccess.paymentStatus === "WAITING_PROOF" &&
              checkoutSuccess.expiredAt ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <PendingExpiryCountdown expiredAt={checkoutSuccess.expiredAt} />
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Batas: {formatDate(checkoutSuccess.expiredAt)}
                  </span>
                </div>
              ) : null}
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
            <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 dark:border-amber-500/30 dark:bg-slate-950/70">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                Upload bukti QRIS untuk menyelesaikan transaksi.
              </p>
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                Transaksi pending akan otomatis expired jika bukti tidak diupload sebelum batas waktu.
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
                  {uploadingProof ? "Mengupload..." : "Upload Bukti"}
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
        <button
          type="button"
          onClick={() => {
            setMobilePaymentSectionVisible(false);
            setMobileCartItemsExpanded(false);
            setMobileCartOpen(true);
          }}
          data-mobile-hide-on-input
          className={`fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-teal-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 shadow-lg shadow-slate-900/10 transition duration-200 dark:border-teal-500/30 dark:bg-slate-900 dark:text-slate-100 sm:inset-x-4 sm:bottom-20 sm:min-h-14 sm:rounded-2xl sm:px-4 sm:py-3 xl:hidden ${
            productSearchFocused
              ? "invisible pointer-events-none translate-y-24 opacity-0"
              : "visible translate-y-0 opacity-100"
          }`}
        >
          <span className="min-w-0">
            <span className="block truncate">Lihat keranjang</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {cartItemCount} item siap checkout
            </span>
          </span>
          <span className="shrink-0 tabular-nums">{rupiah(grandTotal)}</span>
        </button>
      ) : null}

      {mobileCartSheetOpen ? (
        <button
          type="button"
          data-mobile-blocking-overlay
          aria-label="Tutup keranjang"
          onClick={() => setMobileCartOpen(false)}
          className="fixed inset-0 z-40 touch-none overscroll-contain bg-slate-950/45 xl:hidden"
        />
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(440px,480px)] 2xl:grid-cols-[minmax(0,1fr)_500px]">
        <div className="min-w-0 space-y-2.5 sm:space-y-4">
          <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:rounded-3xl sm:p-4">
            <div className="mb-2 flex flex-col gap-1 sm:mb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
                  Area Produk
                </p>
                <h2 className="mobile-section-heading mt-0.5">
                  Produk
                </h2>
              </div>
              <p className="w-fit shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:px-3 sm:py-1 sm:text-xs">
                {filteredProducts.length} produk ditemukan
              </p>
            </div>

            <div className="mb-2.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 dark:border-slate-800 dark:bg-slate-950/50 sm:mb-4 sm:p-3">
              <div className="grid gap-2">
                <LocalLiveSearchInput
                  value={search}
                  onSearch={handleProductSearch}
                  placeholder="Cari produk, SKU, barcode, brand..."
                  className="min-w-0"
                  onFocus={() => setProductSearchFocused(true)}
                  onBlur={() => setProductSearchFocused(false)}
                />

                <div className="grid grid-cols-[minmax(0,1fr)_136px] items-center gap-1.5 sm:grid-cols-[minmax(0,1fr)_180px] sm:gap-2 lg:grid-cols-[minmax(0,210px)_180px] lg:justify-end">
                  <label className="relative block min-w-0">
                    <select
                      value={selectedCategory}
                      onChange={(event) => {
                        setSelectedCategory(event.target.value);
                        setProductPage(1);
                      }}
                      className="min-h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-xs font-semibold text-slate-700 outline-none transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 sm:min-h-11 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:pr-10 sm:text-sm"
                    >
                      <option value="Semua">Semua Kategori</option>
                      {categoryOptions.map((category) => (
                        <option key={category.key} value={category.key}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 sm:right-4" />
                  </label>

                  <div className="grid min-h-10 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-slate-950 sm:min-h-11 sm:p-1">
                    <button
                      type="button"
                      onClick={() => setProductView("grid")}
                      aria-label="Tampilkan produk dalam mode Grid"
                      aria-pressed={productView === "grid"}
                      className={
                        productView === "grid"
                          ? "inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-xs font-extrabold text-teal-800 shadow-sm ring-1 ring-teal-200/80 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20 sm:gap-1.5 sm:px-3 sm:text-sm"
                          : "inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-slate-600 transition hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 dark:text-slate-300 dark:hover:bg-teal-400/10 dark:hover:text-teal-100 sm:gap-1.5 sm:px-3 sm:text-sm"
                      }
                    >
                      <Grid2X2 className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                      <span>Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductView("list")}
                      aria-label="Tampilkan produk dalam mode List"
                      aria-pressed={productView === "list"}
                      className={
                        productView === "list"
                          ? "inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-xs font-extrabold text-teal-800 shadow-sm ring-1 ring-teal-200/80 dark:border-teal-400/30 dark:bg-teal-400/15 dark:text-teal-100 dark:ring-teal-400/20 sm:gap-1.5 sm:px-3 sm:text-sm"
                          : "inline-flex min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-bold text-slate-600 transition hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 dark:text-slate-300 dark:hover:bg-teal-400/10 dark:hover:text-teal-100 sm:gap-1.5 sm:px-3 sm:text-sm"
                      }
                    >
                      <List className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                      <span>List</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 border-t border-slate-200/80 pt-1.5 dark:border-slate-800 sm:mt-3 sm:pt-3">
                <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
                    Kategori cepat
                  </p>
                  <p className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
                    Aktif: {selectedCategory === "Semua" ? "Semua" : selectedCategory}
                  </p>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
                  {[{ key: "Semua", label: "Semua" }, ...categoryOptions].map((category) => {
                    const active = selectedCategory === category.key;

                    return (
                      <button
                        key={category.key}
                        onClick={() => {
                          setSelectedCategory(category.key);
                          setProductPage(1);
                        }}
                        className={
                          active
                            ? "mobile-pill mobile-pill-active sm:min-h-8 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs"
                            : "mobile-pill hover:bg-slate-50 hover:text-teal-700 dark:hover:bg-slate-800 dark:hover:text-teal-100 sm:min-h-8 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs"
                        }
                        type="button"
                      >
                        {category.key === "Semua" ? (
                          <PackageSearch className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        ) : (
                          categoryIconElement(category.label, "h-3 w-3 sm:h-3.5 sm:w-3.5")
                        )}
                        {category.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

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
              data-search-results
              className={
                productView === "grid"
                  ? "grid scroll-mt-24 grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4"
                  : "grid scroll-mt-24 gap-2 sm:gap-3"
              }
            >
              {visibleProducts.map((product) => (
                <article
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Lihat detail ${product.name}`}
                  onClick={() => setProductDetail(product)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setProductDetail(product);
                    }
                  }}
                  className={`group mobile-card-surface flex min-h-0 cursor-pointer flex-col hover:border-teal-200 hover:bg-teal-50/20 active:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/10 dark:focus-visible:ring-offset-slate-950 sm:min-h-[190px] sm:rounded-2xl sm:p-3 ${
                    productView === "grid" ? "p-2" : "p-2.5"
                  }`}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
                    <ProductThumb
                      product={product}
                      className={
                        productView === "grid"
                          ? "h-9 w-9 rounded-lg sm:h-12 sm:w-12 sm:rounded-2xl"
                          : "h-12 w-12 rounded-xl sm:rounded-2xl"
                      }
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-[11px]">
                        {productCodeLabel(product) || "Tanpa SKU"}
                      </p>
                      <h3 className="mt-0.5 line-clamp-2 break-words text-[12px] font-bold leading-snug text-slate-950 dark:text-slate-50 sm:mt-1 sm:text-sm">
                        {product.name}
                      </h3>
                      {productCompactMeta(product) ? (
                        <p
                          className={`mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400 ${
                            productView === "grid" ? "hidden sm:block" : "block"
                          }`}
                        >
                          {productCompactMeta(product)}
                        </p>
                      ) : null}
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        addToCart(product);
                      }}
                      disabled={product.stock <= 0}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-base font-bold text-white shadow-sm shadow-teal-600/15 transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 sm:h-9 sm:w-9 sm:rounded-xl"
                      type="button"
                      aria-label={`Tambah ${product.name}`}
                    >
                      +
                    </button>
                  </div>

                  <div className="mt-1 flex min-w-0 flex-1 flex-col justify-end sm:mt-3">
                    <div className="rounded-xl border border-transparent bg-transparent p-0 dark:bg-transparent sm:rounded-2xl sm:border-slate-100 sm:bg-slate-50/80 sm:p-3 sm:dark:border-slate-800 sm:dark:bg-slate-900/70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="hidden text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:block">
                            Harga jual
                          </p>
                          <p className="metric-value truncate text-[13px] leading-tight sm:mt-1 sm:text-base">
                            {rupiah(product.price)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300 sm:bg-white sm:px-2.5 sm:py-1 sm:text-xs sm:ring-1 sm:ring-slate-200 sm:dark:bg-slate-950 sm:dark:ring-slate-800">
                          / {product.unit}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 border-t border-slate-100 pt-1 dark:border-slate-800 sm:mt-3 sm:gap-3 sm:border-slate-200/80 sm:pt-2">
                        <span className="min-w-0 truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                          {formatCategoryLabel(product.category)}
                        </span>
                        <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-300 sm:text-xs">
                          Sisa {product.stock} {product.unit}
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
              pageSize={productPageSize}
              onPageChange={handleProductPageChange}
              itemLabel="produk"
              className="mt-3 -mx-2 -mb-2 rounded-b-2xl sm:mt-5 sm:-mx-4 sm:-mb-4 sm:rounded-b-3xl"
            />
          </section>

          <section className="rounded-2xl border border-slate-200/70 bg-white/60 p-1.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 sm:p-2">
            <div className="mb-1.5 flex items-center justify-between gap-3 px-1 sm:mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:text-xs">
                Ringkasan cepat
              </p>
              <p className="hidden text-xs font-medium text-slate-400 dark:text-slate-500 sm:block">
                Informasi pendukung shift
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1 sm:gap-2 xl:grid-cols-4">
            {canOpenInventoryDetails ? (
              <button
                type="button"
                onClick={() => openSummaryDetail("total-products")}
                className="mobile-card-surface flex items-center gap-2 p-2 text-left hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:gap-3 sm:p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200 sm:h-9 sm:w-9">
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                    Total Produk
                  </p>
                  <p className="metric-value text-sm sm:text-base">
                    {summary.totalProducts}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                    {summaryLoading === "total-products"
                      ? "Memuat..."
                      : "Item tersedia"}
                  </p>
                </div>
              </button>
            ) : (
              <div className="mobile-card-surface flex items-center gap-2 p-2 sm:gap-3 sm:p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-200 sm:h-9 sm:w-9">
                  <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                    Total Produk
                  </p>
                  <p className="metric-value text-sm sm:text-base">
                    {summary.totalProducts}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                    Readonly
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => openSummaryDetail("low-stock")}
              className="mobile-card-surface flex items-center gap-2 p-2 text-left hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:gap-3 sm:p-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200 sm:h-9 sm:w-9">
                <PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                  Stok Rendah
                </p>
                <p className="metric-value text-sm sm:text-base">{summary.lowStockCount}</p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                  {summaryLoading === "low-stock"
                    ? "Memuat..."
                    : "Perlu restock"}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openSummaryDetail("today-transactions")}
              className="mobile-card-surface flex items-center gap-2 p-2 text-left hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:gap-3 sm:p-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200 sm:h-9 sm:w-9">
                <CalendarDays className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                  Transaksi Hari Ini
                </p>
                <p className="metric-value text-sm sm:text-base">
                  {summary.todayTransactions}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
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
              className="mobile-card-surface flex items-center gap-2 p-2 text-left hover:bg-slate-50 active:bg-slate-50 dark:hover:bg-slate-900 sm:gap-3 sm:p-3"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200 sm:h-9 sm:w-9">
                <Wallet className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                  Total Penjualan
                </p>
                <p className="metric-value truncate text-sm sm:text-base">
                  {rupiah(summary.totalSales)}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                  {summaryLoading === "total-sales"
                    ? "Memuat..."
                    : currentRole === "cashier"
                      ? "Shift kasir"
                      : "Hari ini"}
                </p>
              </div>
            </button>
            </div>
          </section>
        </div>

        <aside
          data-mobile-sheet
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] min-w-0 flex-col overflow-hidden rounded-t-[22px] border-t border-slate-200 bg-[#f6f8fb] shadow-2xl transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 xl:hidden ${
            mobileCartSheetOpen
              ? "visible translate-y-0 pointer-events-auto"
              : "invisible translate-y-full pointer-events-none"
          }`}
        >
          <div className="shrink-0 px-3 pb-2 pt-2">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                  Transaksi
                </p>
                <h2 className="truncate text-lg font-bold text-slate-950 dark:text-slate-50">
                  Keranjang & Pembayaran
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                aria-label="Tutup keranjang"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div
            ref={mobileCartScrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 pb-2 [-webkit-overflow-scrolling:touch]"
          >
            <section className="rounded-2xl border border-teal-200 bg-teal-50 p-3 dark:border-teal-500/30 dark:bg-teal-500/10">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                    Total Bayar
                  </p>
                  <p className="text-2xl font-extrabold tabular-nums text-slate-950 dark:text-slate-50">
                    {rupiah(grandTotal)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-teal-700 ring-1 ring-teal-100 dark:bg-slate-950 dark:text-teal-200 dark:ring-teal-500/20">
                  {cartItemCount} item
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-2">
                  <ShoppingCart className="h-4 w-4 shrink-0 text-slate-700 dark:text-slate-200" />
                  <h3 className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">
                    Detail item
                  </h3>
                </div>
                <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {cart.length} baris
                </span>
              </div>

              <div className="space-y-1.5 p-2">
                {visibleMobileCartItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 gap-2">
                        <ProductThumb
                          product={item}
                          className="h-8 w-8 rounded-lg"
                        />
                        <div className="min-w-0">
                          <p className="line-clamp-1 break-words text-xs font-bold text-slate-950 dark:text-slate-50">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {rupiah(item.price)} / {item.unit}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="mb-0.5 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                          aria-label={`Hapus ${item.name} dari keranjang`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                        <p className="text-xs font-bold tabular-nums text-slate-950 dark:text-slate-50">
                          {rupiah(cartLineTotal(item))}
                        </p>
                      </div>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <button
                        onClick={() => decreaseQty(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-bold transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        type="button"
                        aria-label={`Kurangi qty ${item.name}`}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        max={item.stock}
                        value={item.qtyInput}
                        onChange={(event) =>
                          applyManualQty(item.id, event.target.value)
                        }
                        onBlur={(event) =>
                          applyManualQty(item.id, event.target.value, true)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            applyManualQty(
                              item.id,
                              event.currentTarget.value,
                              true,
                            );
                            event.currentTarget.blur();
                          }
                        }}
                        className="h-7 w-12 rounded-lg border border-slate-300 bg-white px-2 text-center text-xs font-bold tabular-nums text-slate-950 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        aria-label={`Qty ${item.name}`}
                      />
                      <button
                        onClick={() => increaseQty(item.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-bold transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                        type="button"
                        aria-label={`Tambah qty ${item.name}`}
                      >
                        +
                      </button>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {item.unit}
                      </span>
                      <button
                        type="button"
                        onClick={() => openDiscountModal(item)}
                        className="ml-auto inline-flex h-7 items-center justify-center rounded-lg border border-teal-300 bg-white px-2 text-[10px] font-bold text-teal-700 transition hover:bg-teal-50 dark:border-teal-500/40 dark:bg-slate-900 dark:text-teal-200 dark:hover:bg-teal-500/10"
                      >
                        Diskon
                      </button>
                    </div>
                  </div>
                ))}

                {hiddenMobileCartItemCount > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setMobileCartItemsExpanded((current) => !current)
                    }
                    className="flex w-full items-center justify-center rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-center text-xs font-bold text-teal-700 transition hover:bg-teal-100 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200 dark:hover:bg-teal-500/20"
                    aria-expanded={mobileCartItemsExpanded}
                  >
                    {mobileCartItemsExpanded
                      ? "Ringkas item"
                      : `Lihat semua item (+${hiddenMobileCartItemCount})`}
                  </button>
                ) : null}
              </div>
            </section>

            <details
              ref={mobileCustomerAutocompleteRef}
              data-customer-form
              className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Customer opsional
                  </span>
                  <span className="block truncate text-sm font-bold text-slate-950 dark:text-slate-50">
                    {foundCustomer?.name ||
                      customerName ||
                      customerPhone ||
                      "Isi jika diperlukan"}
                  </span>
                </span>
                {foundCustomer ? (
                  <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
                    Terhubung
                  </span>
                ) : null}
              </summary>

              <div className="mt-3 grid gap-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Nomor WhatsApp
                  </span>
                  <span className="relative block">
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
                      className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-11 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
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
                  </span>
                  {customerPhone &&
                  !loadingCustomer &&
                  !foundCustomer &&
                  customerLookupMessage ? (
                    <span className="mt-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      {customerLookupMessage}
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Nama Customer
                  </span>
                  <input
                    data-customer-name-input
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
                    className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="Nama customer (opsional)"
                  />
                  <span className="relative block">
                    {renderCustomerSuggestions("name")}
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Alamat
                  </span>
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(event) => setCustomerAddress(event.target.value)}
                    className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="Opsional"
                  />
                </label>

                {customerPhone && (loadingCustomer || foundCustomer) ? (
                  <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
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
            </details>

            <section
              ref={mobilePaymentSectionRef}
              id="mobile-payment-section"
              tabIndex={-1}
              className="scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-500/30 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Pembayaran
                </p>
                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {selectedPaymentMethod?.name ?? "Metode belum dipilih"}
                </p>
              </div>
              <div className="grid gap-2">
                <div>
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Metode Pembayaran
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.code}
                        type="button"
                        onClick={() => setPaymentMethod(method.code)}
                        className={
                          paymentMethod === method.code
                            ? "min-h-9 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-semibold text-slate-50 shadow-sm transition-colors duration-150 dark:bg-teal-500 dark:text-slate-950"
                            : "min-h-9 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10"
                        }
                      >
                        {method.name}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Dibayar
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={formatRupiahIntegerInput(paidAmount)}
                    onChange={handlePaidAmountChange}
                    placeholder={formatRupiahIntegerInput(String(grandTotal))}
                    className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </label>
              </div>

              {selectedPaymentMethod?.type === "BANK_TRANSFER" ? (
                <div className="mt-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800">
                  <p className="font-semibold">Transfer Bank</p>
                  <p className="mt-1">
                    Detail rekening tampil di modal checkout.
                  </p>
                </div>
              ) : null}

              {selectedPaymentMethod?.type === "QRIS" ? (
                <div className="mt-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-700 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-800">
                  <p className="font-semibold">QRIS Statis</p>
                  <p className="mt-1">
                    QRIS besar tampil setelah kasir klik Checkout.
                  </p>
                </div>
              ) : null}

              <button
                onClick={initiateCheckout}
                disabled={loadingCheckout || cart.length === 0}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-teal-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm shadow-teal-600/20 transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
                type="button"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ShoppingBag className="h-5 w-5 shrink-0" />
                  <span className="truncate">
                    {loadingCheckout ? "Memproses..." : "Bayar Sekarang"}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold">
                  {cartItemCount} item
                </span>
              </button>
            </section>
          </div>

          <div
            className={
              mobilePaymentSectionVisible
                ? "hidden"
                : "shrink-0 border-t border-teal-200 bg-white/95 p-2 shadow-lg shadow-slate-900/10 dark:border-teal-500/30 dark:bg-slate-900/95"
            }
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="min-w-0 text-xs font-semibold text-slate-500 dark:text-slate-400">
                {selectedPaymentMethod?.name ?? "Pilih pembayaran"}
              </span>
              <span className="shrink-0 text-base font-extrabold tabular-nums text-slate-950 dark:text-slate-50">
                {rupiah(grandTotal)}
              </span>
            </div>
            <button
              onClick={scrollToMobilePaymentSection}
              disabled={cart.length === 0}
              className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-teal-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm shadow-teal-600/20 transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
              type="button"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <ShoppingBag className="h-5 w-5 shrink-0" />
                <span className="truncate">
                  Lanjut ke Pembayaran
                </span>
              </span>
              <span className="shrink-0 text-xs font-semibold">
                {cartItemCount} item
              </span>
            </button>
          </div>
        </aside>

        <aside
          data-mobile-sheet
          className={`hidden min-w-0 flex-col gap-2 overflow-y-auto overscroll-contain rounded-t-[22px] border-t border-slate-200 bg-[#f6f8fb] p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-2xl transition-transform duration-200 [-webkit-overflow-scrolling:touch] dark:border-slate-800 dark:bg-slate-950 sm:max-h-[88dvh] sm:gap-3 sm:rounded-t-[28px] sm:p-4 xl:sticky xl:inset-auto xl:top-5 xl:z-auto xl:flex xl:max-h-none xl:translate-y-0 xl:overflow-visible xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none xl:dark:bg-transparent ${
            mobileCartSheetOpen
              ? "visible translate-y-0 pointer-events-auto"
              : "invisible translate-y-full pointer-events-none xl:visible xl:pointer-events-auto"
          }`}
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700 sm:h-1.5 sm:w-12 xl:hidden" />
          <div className="mb-2.5 flex items-center justify-between gap-3 sm:mb-4 xl:hidden">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300 sm:text-xs">
                Transaksi
              </p>
              <h2 className="mt-0.5 truncate text-lg font-bold text-slate-950 dark:text-slate-50 sm:mt-1 sm:text-xl">
                Keranjang & Checkout
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 sm:h-10 sm:w-10 sm:rounded-2xl"
              aria-label="Tutup keranjang"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <section
            ref={customerAutocompleteRef}
            data-customer-form
            className="order-2 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:order-1"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <User className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Customer
                  </p>
                  <h2 className="truncate text-sm font-bold text-slate-950 dark:text-slate-50">
                    Data pembeli
                  </h2>
                </div>
              </div>
              {foundCustomer ? (
                <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
                  Terhubung
                </span>
              ) : null}
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
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
                    className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 pr-11 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
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
                {customerPhone &&
                !loadingCustomer &&
                !foundCustomer &&
                customerLookupMessage ? (
                  <p className="mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {customerLookupMessage}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Nama Customer
                </label>
                <input
                  ref={customerNameInputRef}
                  data-customer-name-input
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
                  className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Nama customer (opsional)"
                />
                <div className="relative">{renderCustomerSuggestions("name")}</div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Alamat
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                  placeholder="Opsional"
                />
              </div>

              {customerPhone && (loadingCustomer || foundCustomer) ? (
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/70 dark:text-slate-300 sm:col-span-2 xl:col-span-1 2xl:col-span-2">
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

          <section id="pos-cart" className="order-1 scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 xl:order-2">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800 sm:px-4 sm:py-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                <div>
                  <p className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 xl:block">
                    Transaksi
                  </p>
                  <h2 className="text-sm font-bold text-slate-950 dark:text-slate-50 sm:text-base">
                    Keranjang & Pembayaran
                  </h2>
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200 sm:py-1 sm:text-xs">
                {cartItemCount} item
              </span>
            </div>

            <div className="mx-2.5 mt-2.5 min-h-[96px] space-y-1.5 overflow-visible rounded-xl bg-slate-50/70 p-1.5 dark:bg-slate-950/50 sm:mx-3 sm:mt-3 sm:min-h-[118px] sm:space-y-2 sm:rounded-2xl sm:p-2 xl:max-h-[360px] xl:overflow-y-auto xl:overscroll-contain xl:[-webkit-overflow-scrolling:touch]">
              {cart.length === 0 ? (
                <div className="flex min-h-[92px] flex-col items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400 sm:min-h-[108px]">
                  <ShoppingCart className="mb-1.5 h-7 w-7 text-slate-300 dark:text-slate-600 sm:mb-2 sm:h-8 sm:w-8" />
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
                  className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900 sm:p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2.5 sm:mb-2.5 sm:gap-3">
                    <div className="flex min-w-0 gap-2.5 sm:gap-3">
                      <ProductThumb
                        product={item}
                        className="h-9 w-9 rounded-lg sm:h-10 sm:w-10 sm:rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words text-[13px] font-semibold text-slate-950 dark:text-slate-50 sm:text-sm">
                          {item.name}
                        </p>
                        <p className="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-400">
                          {item.sku}
                        </p>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:text-xs">
                          {rupiah(item.price)} / {item.unit} - Stok {item.stock} {item.unit}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <button
                        type="button"
                        onClick={() => removeCartItem(item.id)}
                        className="mb-1 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                        aria-label={`Hapus ${item.name} dari keranjang`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <p className="text-[13px] font-bold tabular-nums text-slate-950 dark:text-slate-50 sm:text-sm">
                        {rupiah(cartLineTotal(item))}
                      </p>
                      {cartLineDiscountAmount(item) > 0 ? (
                        <p className="text-xs tabular-nums text-rose-600 dark:text-rose-300">
                          -{rupiah(cartLineDiscountAmount(item))}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => decreaseQty(item.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-base font-bold transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      type="button"
                      aria-label={`Kurangi qty ${item.name}`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max={item.stock}
                      value={item.qtyInput}
                      onChange={(event) =>
                        applyManualQty(item.id, event.target.value)
                      }
                      onBlur={(event) =>
                        applyManualQty(item.id, event.target.value, true)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyManualQty(
                            item.id,
                            event.currentTarget.value,
                            true,
                          );
                          event.currentTarget.blur();
                        }
                      }}
                      className="h-8 w-14 rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-bold tabular-nums text-slate-950 outline-none transition-colors focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 sm:w-16"
                      aria-label={`Qty ${item.name}`}
                    />
                    <button
                      onClick={() => increaseQty(item.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-base font-bold transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                      type="button"
                      aria-label={`Tambah qty ${item.name}`}
                    >
                      +
                    </button>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                      {item.unit}
                    </span>
                  </div>

                  <div className="mt-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-950/60 sm:mt-2.5 sm:p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Diskon Item
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 sm:mt-1">
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
                        className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border border-teal-300 px-2.5 text-[11px] font-bold text-teal-700 transition hover:bg-teal-50 dark:border-teal-500/40 dark:text-teal-200 dark:hover:bg-teal-500/10 sm:min-h-9 sm:px-3 sm:text-xs"
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

            <div className="mt-2.5 space-y-2.5 border-t border-slate-200 px-2.5 pb-2.5 pt-2.5 dark:border-slate-800 sm:mt-3 sm:space-y-3 sm:px-3 sm:pb-3 sm:pt-3">
              <div className="rounded-xl bg-teal-50 p-3 dark:bg-teal-500/10 sm:rounded-2xl sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                    Total Bayar
                  </span>
                  <span className="metric-value text-xl sm:text-2xl">{rupiah(grandTotal)}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-teal-700 dark:text-teal-300">
                  {cartItemCount} item dalam keranjang
                </p>
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

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-950/50 sm:rounded-2xl sm:p-3">
                <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Pembayaran
                  </p>
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                    {selectedPaymentMethod?.name ?? "Metode belum dipilih"}
                  </p>
                </div>
                <div className="grid gap-2.5">
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Metode Pembayaran
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {paymentMethods.map((method) => (
                        <button
                          key={method.code}
                          type="button"
                          onClick={() => setPaymentMethod(method.code)}
                          className={
                            paymentMethod === method.code
                              ? "min-h-9 rounded-full bg-teal-600 px-4 py-1.5 text-sm font-semibold text-slate-50 shadow-sm transition-colors duration-150 dark:bg-teal-500 dark:text-slate-950"
                              : "min-h-9 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-150 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-teal-500/10"
                          }
                        >
                          {method.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Dibayar
                    </label>
                    <input
                      ref={paidAmountInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formatRupiahIntegerInput(paidAmount)}
                      onChange={handlePaidAmountChange}
                      placeholder={formatRupiahIntegerInput(String(grandTotal))}
                      className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 transition-colors duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:px-4"
                    />
                  </div>
                </div>

                {selectedPaymentMethod?.type === "BANK_TRANSFER" ? (
                  <div className="mt-2 rounded-xl bg-white p-2.5 text-sm text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 sm:p-3">
                    <p className="font-semibold">Transfer Bank</p>
                    <p className="mt-1 text-xs">
                      Detail rekening akan tampil jelas di modal checkout.
                    </p>
                  </div>
                ) : null}

                {selectedPaymentMethod?.type === "QRIS" ? (
                  <div className="mt-2 rounded-xl bg-white p-2.5 text-sm text-slate-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 sm:p-3">
                    <p className="font-semibold">QRIS Statis</p>
                    <p className="mt-1 text-xs">
                      QRIS besar akan tampil di modal checkout setelah kasir klik
                      Checkout.
                    </p>
                  </div>
                ) : null}
              </div>

              <button
                onClick={initiateCheckout}
                disabled={loadingCheckout || cart.length === 0}
                className="inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-xl bg-teal-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm shadow-teal-600/20 transition-colors duration-200 hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 sm:min-h-12 sm:rounded-2xl sm:px-4 sm:py-3"
                type="button"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <ShoppingBag className="h-5 w-5 shrink-0" />
                  <span className="truncate">
                    {loadingCheckout ? "Memproses..." : "Bayar Sekarang"}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{rupiah(grandTotal)}</span>
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
