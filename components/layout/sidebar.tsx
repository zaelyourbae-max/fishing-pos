"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Package,
  PackagePlus,
  RotateCcw,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

import LogoutButton from "@/components/layout/logout-button";
import ThemeToggle from "@/components/layout/theme-toggle";
import { useGlobalInteractionCleanup } from "@/lib/global-interaction-state";
import {
  canAccessReports,
  canAccessReturns,
  canAccessSettings,
  canAccessSuppliers,
  canManageUsers,
  type RoleSlug,
} from "@/lib/permissions";

type SidebarProps = {
  role: RoleSlug;
};

type MenuItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

function primaryMobileMenus(role: RoleSlug): MenuItem[] {
  return [
    role === "cashier"
      ? { name: "Dashboard", href: "/cashier", icon: LayoutDashboard }
      : { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "POS", href: "/pos", icon: ShoppingCart },
    { name: "Penjualan", href: "/sales", icon: FileText },
    { name: "Customer", href: "/customers", icon: Users },
  ];
}

function buildMenus(role: RoleSlug): MenuItem[] {
  const menus: MenuItem[] = [
    role === "cashier"
      ? { name: "Dashboard", href: "/cashier", icon: LayoutDashboard }
      : { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "POS", href: "/pos", icon: ShoppingCart },
    { name: "Produk", href: "/products", icon: Package },
    { name: "Penjualan", href: "/sales", icon: FileText },
  ];

  if (canAccessReturns(role)) {
    menus.push({ name: "Retur", href: "/returns", icon: RotateCcw });
  }

  menus.push({ name: "Customer", href: "/customers", icon: Users });

  if (role !== "cashier") {
    menus.push({ name: "Pembelian", href: "/purchases", icon: PackagePlus });
  }

  if (canAccessSuppliers(role)) {
    menus.push({ name: "Supplier", href: "/suppliers", icon: Truck });
  }

  if (canAccessReports(role)) {
    menus.push({ name: "Laporan", href: "/reports", icon: BarChart3 });
  }

  if (canManageUsers(role)) {
    menus.push({ name: "User", href: "/users", icon: Users });
  }

  if (canAccessSettings(role)) {
    menus.push({ name: "Pengaturan", href: "/settings", icon: Settings });
  }

  return menus;
}

function Brand() {
  return (
    <div>
      <h1 className="font-sans text-[23px] font-extrabold leading-none tracking-wide text-teal-700 dark:text-teal-400 sm:text-[26px] md:text-[30px]">
        MEIJRVERSE°
      </h1>
      <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:mt-2 sm:text-xs">
        Retail System
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: SidebarProps["role"] }) {
  return role === "developer" ? (
    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 dark:border-teal-800 dark:bg-teal-500/10 dark:text-teal-300 lg:mt-4 lg:inline-flex">
      Developer
    </span>
  ) : null;
}

function MenuList({
  menus,
  pathname,
  onNavigate,
}: {
  menus: MenuItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-2">
      {menus.map((menu) => {
        const Icon = menu.icon;
        const isActive =
          pathname === menu.href ||
          (menu.href !== "/" && pathname.startsWith(`${menu.href}/`));

        return (
          <Link
            key={menu.name}
            href={menu.href}
            onClick={onNavigate}
            className={
              isActive
                ? "flex min-h-11 w-full items-center gap-3 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700 shadow-sm ring-1 ring-teal-100 transition duration-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/20"
                : "flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-600 transition duration-200 hover:bg-slate-50 hover:text-slate-950 active:scale-[0.99] dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{menu.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar({ role }: SidebarProps) {
  const menus = buildMenus(role);
  const mobileMenus = primaryMobileMenus(role);
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const primaryHrefs = new Set(mobileMenus.map((menu) => menu.href));
  const moreActive = menus.some(
    (menu) =>
      !primaryHrefs.has(menu.href) &&
      (pathname === menu.href ||
        (menu.href !== "/" && pathname.startsWith(`${menu.href}/`))),
  );

  const openDrawer = useCallback(() => {
    setDrawerMounted(true);
    window.requestAnimationFrame(() => setDrawerOpen(true));
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  useEffect(() => {
    if (!drawerMounted || drawerOpen) {
      return;
    }

    const timeout = window.setTimeout(() => setDrawerMounted(false), 240);
    return () => window.clearTimeout(timeout);
  }, [drawerMounted, drawerOpen]);

  useGlobalInteractionCleanup(drawerOpen);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDrawer, drawerOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 p-3 text-slate-900 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100 sm:p-4 lg:hidden">
        <div className="min-w-0">
          <Brand />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={openDrawer}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition duration-200 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 active:scale-95 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-teal-500/10 sm:h-11 sm:w-11 sm:rounded-2xl"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {drawerMounted ? (
        <div
          data-mobile-blocking-overlay
          className={`fixed inset-0 z-50 lg:hidden ${
            drawerOpen
              ? "visible pointer-events-auto"
              : "invisible pointer-events-none"
          }`}
        >
          <button
            type="button"
            className={`absolute inset-0 touch-none bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
              drawerOpen ? "opacity-100" : "opacity-0"
            }`}
            onClick={closeDrawer}
            aria-label="Tutup menu"
          />
          <aside
            className={`relative flex h-dvh max-h-dvh w-[min(88vw,22rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-r-[1.75rem] border-r border-slate-200 bg-white text-slate-900 shadow-2xl shadow-slate-950/20 transition-transform duration-300 ease-out will-change-transform dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 ${
              drawerOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-4 pb-4 dark:border-slate-800 sm:p-5">
              <div>
                <Brand />
                <div className="mt-4">
                  <RoleBadge role={role} />
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 transition duration-200 hover:bg-slate-50 active:scale-95 dark:border-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <MenuList
                menus={menus}
                pathname={pathname}
                onNavigate={closeDrawer}
              />
            </div>
            <div className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-800 sm:p-5">
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-slate-200 bg-white/95 p-5 text-slate-900 shadow-[10px_0_30px_rgba(15,23,42,0.03)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100 lg:flex">
        <div className="mb-6 shrink-0">
          <Brand />
          <RoleBadge role={role} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <MenuList menus={menus} pathname={pathname} />
        </div>

        <div className="shrink-0 space-y-3 pt-4">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </aside>

      <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 text-slate-600 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur transition duration-200 ease-out dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-300 sm:px-2 sm:pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pt-2 lg:hidden">
        {mobileMenus.map((menu) => {
          const Icon = menu.icon;
          const active =
            pathname === menu.href ||
            (menu.href !== "/" && pathname.startsWith(`${menu.href}/`));

          return (
            <Link
              key={menu.name}
              href={menu.href}
              className={
                active
                  ? "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl bg-teal-50 text-teal-700 transition duration-200 dark:bg-teal-500/10 dark:text-teal-300 sm:min-h-12 sm:gap-1 sm:rounded-2xl"
                  : "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl transition duration-200 hover:bg-slate-100 hover:text-slate-950 active:scale-[0.98] dark:hover:bg-slate-900 dark:hover:text-slate-100 sm:min-h-12 sm:gap-1 sm:rounded-2xl"
              }
            >
              <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              <span className="text-[10px] font-bold leading-none sm:text-[11px]">
                {menu.name}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={openDrawer}
          className={
            moreActive
              ? "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl bg-teal-50 text-teal-700 transition duration-200 dark:bg-teal-500/10 dark:text-teal-300 sm:min-h-12 sm:gap-1 sm:rounded-2xl"
              : "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl transition duration-200 hover:bg-slate-100 hover:text-slate-950 active:scale-[0.98] dark:hover:bg-slate-900 dark:hover:text-slate-100 sm:min-h-12 sm:gap-1 sm:rounded-2xl"
          }
          aria-label="Buka menu lainnya"
        >
          <MoreHorizontal className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
          <span className="text-[10px] font-bold leading-none sm:text-[11px]">Lainnya</span>
        </button>
      </nav>
    </>
  );
}
