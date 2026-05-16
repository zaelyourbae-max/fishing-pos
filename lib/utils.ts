import type { Product } from "@prisma/client";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export type { Product };

export type ProductFormData = Omit<
  Product,
  "id" | "createdAt" | "updatedAt" | "isActive"
>;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getStockStatus(
  stock: number,
  minStock: number
): "ok" | "low" | "empty" {
  if (stock === 0) return "empty";
  if (stock <= minStock) return "low";
  return "ok";
}

export const STOCK_STATUS_LABEL = {
  ok: "Tersedia",
  low: "Stok Menipis",
  empty: "Habis",
} as const;

export const STOCK_STATUS_COLOR = {
  ok: "text-emerald-400",
  low: "text-amber-400",
  empty: "text-red-400",
} as const;

export const DEFAULT_CATEGORIES = [
  "Umpan",
  "Kail",
  "Senar",
  "Joran",
  "Reel",
  "Pelampung",
  "Ember & Jaring",
  "Aksesoris",
  "Pakaian",
  "Lainnya",
] as const;

export const DEFAULT_UNITS = [
  "pcs",
  "lusin",
  "box",
  "pak",
  "kg",
  "gram",
  "liter",
  "roll",
  "meter",
] as const;
