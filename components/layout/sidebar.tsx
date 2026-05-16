"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  FileText,
  LayoutDashboard,
  Menu,
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

type SidebarProps = {
  role: "owner" | "cashier" | "developer";
};

type MenuItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

const ownerMenus: MenuItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "POS", href: "/pos", icon: ShoppingCart },
  { name: "Produk", href: "/products", icon: Package },
  { name: "Penjualan", href: "/sales", icon: FileText },
  { name: "Retur", href: "/returns", icon: RotateCcw },
  { name: "Pembelian", href: "/purchases", icon: PackagePlus },
  { name: "Supplier", href: "/suppliers", icon: Truck },
  { name: "Laporan", href: "/reports", icon: BarChart3 },
  { name: "User", href: "/users", icon: Users },
  { name: "Pengaturan", href: "/settings", icon: Settings },
];

const cashierMenus: MenuItem[] = [
  { name: "POS", href: "/pos", icon: ShoppingCart },
  { name: "Riwayat Penjualan Saya", href: "/sales", icon: FileText },
  { name: "Retur Saya", href: "/returns", icon: RotateCcw },
];

function Brand() {
  return (
    <div>
      <h1 className="font-sans text-[26px] font-extrabold leading-none tracking-wide text-teal-700 dark:text-teal-400 md:text-[30px]">
        MEIJRVERSE°
      </h1>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Retail System
      </p>
    </div>
  );
}

function RoleBadge({ role }: { role: SidebarProps["role"] }) {
  return role === "developer" ? (
    <span className="rounded-full border border-teal-200 px-3 py-1 text-xs font-medium text-teal-700 dark:border-teal-800 dark:text-teal-400 lg:mt-4 lg:inline-flex">
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
                ? "flex min-h-11 w-full items-center gap-3 rounded-xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700 transition-colors duration-200 dark:bg-teal-500/10 dark:text-teal-400"
                : "flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
  const menus = role === "cashier" ? cashierMenus : ownerMenus;
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 lg:hidden">
        <div className="min-w-0">
          <Brand />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-100"
            aria-label="Buka menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setDrawerOpen(false)}
            aria-label="Tutup menu"
          />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col border-r border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <Brand />
                <div className="mt-4">
                  <RoleBadge role={role} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-100"
                aria-label="Tutup menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <MenuList
                menus={menus}
                pathname={pathname}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
            <div className="pt-4">
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <aside className="hidden min-h-screen w-72 shrink-0 border-r border-slate-200 bg-white p-5 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 lg:block">
        <div className="mb-10">
          <Brand />
          <RoleBadge role={role} />
        </div>

        <MenuList menus={menus} pathname={pathname} />

        <div className="mt-6">
          <ThemeToggle />
        </div>

        <LogoutButton />
      </aside>
    </>
  );
}
