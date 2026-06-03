import { prisma } from "@/lib/prisma";
import {
  DEFAULT_LOYALTY_CONFIG,
  type LoyaltyConfig,
} from "@/lib/loyalty";

/**
 * Konfigurasi loyalty yang bisa diatur owner di Pengaturan.
 * Disimpan di tabel Setting (key-value). Module ini server-only (pakai prisma).
 */

export const LOYALTY_SETTING_KEYS = {
  interval: "loyaltyInterval",
  minPurchase: "loyaltyMinPurchase",
} as const;

// Batas wajar agar input tidak merusak perhitungan.
const INTERVAL_MIN = 1;
const INTERVAL_MAX = 1000;
const MIN_PURCHASE_MIN = 0;
const MIN_PURCHASE_MAX = 1_000_000_000;

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function getLoyaltyConfig(): Promise<LoyaltyConfig> {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [LOYALTY_SETTING_KEYS.interval, LOYALTY_SETTING_KEYS.minPurchase],
      },
    },
  });

  const map = new Map(rows.map((row) => [row.key, row.value ?? ""]));
  const intervalRaw = Number(map.get(LOYALTY_SETTING_KEYS.interval));
  const minPurchaseRaw = Number(map.get(LOYALTY_SETTING_KEYS.minPurchase));

  return {
    interval: map.has(LOYALTY_SETTING_KEYS.interval)
      ? clampInt(intervalRaw, INTERVAL_MIN, INTERVAL_MAX, DEFAULT_LOYALTY_CONFIG.interval)
      : DEFAULT_LOYALTY_CONFIG.interval,
    minPurchase: map.has(LOYALTY_SETTING_KEYS.minPurchase)
      ? clampInt(
          minPurchaseRaw,
          MIN_PURCHASE_MIN,
          MIN_PURCHASE_MAX,
          DEFAULT_LOYALTY_CONFIG.minPurchase,
        )
      : DEFAULT_LOYALTY_CONFIG.minPurchase,
  };
}

export async function updateLoyaltyConfig(input: {
  interval?: number;
  minPurchase?: number;
}): Promise<LoyaltyConfig> {
  const ops = [];

  if (input.interval !== undefined) {
    const value = clampInt(
      input.interval,
      INTERVAL_MIN,
      INTERVAL_MAX,
      DEFAULT_LOYALTY_CONFIG.interval,
    );
    ops.push(
      prisma.setting.upsert({
        where: { key: LOYALTY_SETTING_KEYS.interval },
        update: { value: String(value) },
        create: { key: LOYALTY_SETTING_KEYS.interval, value: String(value) },
      }),
    );
  }

  if (input.minPurchase !== undefined) {
    const value = clampInt(
      input.minPurchase,
      MIN_PURCHASE_MIN,
      MIN_PURCHASE_MAX,
      DEFAULT_LOYALTY_CONFIG.minPurchase,
    );
    ops.push(
      prisma.setting.upsert({
        where: { key: LOYALTY_SETTING_KEYS.minPurchase },
        update: { value: String(value) },
        create: { key: LOYALTY_SETTING_KEYS.minPurchase, value: String(value) },
      }),
    );
  }

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }

  return getLoyaltyConfig();
}
