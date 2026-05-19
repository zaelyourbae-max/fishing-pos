import { prisma } from "@/lib/prisma";
import { QRIS_IMAGE_ENDPOINT } from "@/lib/qris-image";

export const DEFAULT_PAYMENT_METHODS = [
  {
    code: "CASH",
    name: "Cash",
    type: "CASH",
  },
  {
    code: "TRANSFER",
    name: "Transfer Bank",
    type: "BANK_TRANSFER",
  },
  {
    code: "QRIS",
    name: "QRIS",
    type: "QRIS",
  },
] as const;

export const PAYMENT_SETTING_KEYS = [
  "bankName",
  "bankAccountNumber",
  "bankAccountOwner",
  "qrisImageUrl",
] as const;

const QRIS_IMAGE_DATA_KEY = "qrisImageDataUrl";

export type PaymentSettingKey = (typeof PAYMENT_SETTING_KEYS)[number];

export const DEFAULT_PAYMENT_SETTINGS: Record<PaymentSettingKey, string> = {
  bankName: "",
  bankAccountNumber: "",
  bankAccountOwner: "",
  qrisImageUrl: "",
};

export async function ensureDefaultPaymentMethods() {
  await prisma.$transaction(
    DEFAULT_PAYMENT_METHODS.map((method) =>
      prisma.paymentMethod.upsert({
        where: {
          code: method.code,
        },
        update: {},
        create: {
          code: method.code,
          name: method.name,
          type: method.type,
          isActive: true,
        },
      }),
    ),
  );
}

export async function getActivePaymentMethods() {
  await ensureDefaultPaymentMethods();

  return prisma.paymentMethod.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      code: "asc",
    },
  });
}

export async function getAllPaymentMethods() {
  await ensureDefaultPaymentMethods();

  return prisma.paymentMethod.findMany({
    orderBy: {
      code: "asc",
    },
  });
}

export async function getPaymentSettings() {
  const rows = await prisma.paymentSetting.findMany({
    where: {
      key: {
        in: [...PAYMENT_SETTING_KEYS],
      },
    },
  });
  const values = {
    ...DEFAULT_PAYMENT_SETTINGS,
  };

  for (const row of rows) {
    if (PAYMENT_SETTING_KEYS.includes(row.key as PaymentSettingKey)) {
      values[row.key as PaymentSettingKey] = row.value ?? "";
    }
  }

  return values;
}

export async function updatePaymentSettings(
  input: Partial<Record<PaymentSettingKey, string>>,
) {
  const entries = Object.entries(input).filter(
    ([key, value]) =>
      PAYMENT_SETTING_KEYS.includes(key as PaymentSettingKey) &&
      value !== undefined,
  ) as [PaymentSettingKey, string][];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.paymentSetting.upsert({
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

  return getPaymentSettings();
}

export async function updateQrisImage(dataUrl: string, cacheKey: string) {
  await prisma.$transaction([
    prisma.paymentSetting.upsert({
      where: {
        key: "qrisImageUrl",
      },
      update: {
        value: `${QRIS_IMAGE_ENDPOINT}?v=${encodeURIComponent(cacheKey)}`,
      },
      create: {
        key: "qrisImageUrl",
        value: `${QRIS_IMAGE_ENDPOINT}?v=${encodeURIComponent(cacheKey)}`,
      },
    }),
    prisma.paymentSetting.upsert({
      where: {
        key: QRIS_IMAGE_DATA_KEY,
      },
      update: {
        value: dataUrl,
      },
      create: {
        key: QRIS_IMAGE_DATA_KEY,
        value: dataUrl,
      },
    }),
  ]);

  return getPaymentSettings();
}

export async function clearQrisImage() {
  await prisma.$transaction([
    prisma.paymentSetting.upsert({
      where: {
        key: "qrisImageUrl",
      },
      update: {
        value: "",
      },
      create: {
        key: "qrisImageUrl",
        value: "",
      },
    }),
    prisma.paymentSetting.upsert({
      where: {
        key: QRIS_IMAGE_DATA_KEY,
      },
      update: {
        value: "",
      },
      create: {
        key: QRIS_IMAGE_DATA_KEY,
        value: "",
      },
    }),
  ]);

  return getPaymentSettings();
}

export async function getQrisImageSource() {
  const rows = await prisma.paymentSetting.findMany({
    where: {
      key: {
        in: ["qrisImageUrl", QRIS_IMAGE_DATA_KEY],
      },
    },
  });
  const values = new Map(rows.map((row) => [row.key, row.value ?? ""]));

  return {
    qrisImageUrl: values.get("qrisImageUrl") ?? "",
    qrisImageDataUrl: values.get(QRIS_IMAGE_DATA_KEY) ?? "",
  };
}
