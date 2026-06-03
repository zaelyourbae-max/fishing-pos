import { prisma } from "@/lib/prisma";

export const SETTING_KEYS = [
  "storeName",
  "storeWhatsApp",
  "storeAddress",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export const DEFAULT_SETTINGS: Record<SettingKey, string> = {
  storeName: "Toko Pancing",
  storeWhatsApp: "628123456789",
  storeAddress: "Alamat toko belum diset",
};

export async function getSettings() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [...SETTING_KEYS],
      },
    },
  });
  const values = {
    ...DEFAULT_SETTINGS,
  };

  for (const row of rows) {
    if (SETTING_KEYS.includes(row.key as SettingKey)) {
      values[row.key as SettingKey] = row.value ?? "";
    }
  }

  return values;
}

export async function updateSettings(input: Partial<Record<SettingKey, string>>) {
  const entries = Object.entries(input).filter(
    ([key, value]) =>
      SETTING_KEYS.includes(key as SettingKey) && value !== undefined,
  ) as [SettingKey, string][];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: {
          key,
        },
        update: {
          value,
        },
        create: {
          key,
          value,
        },
      }),
    ),
  );

  return getSettings();
}
