import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

/**
 * Status operasional toko (saklar utama buka/tutup).
 *
 * Berbeda dengan DailyClosing yang bersifat per-tanggal, status ini "nempel"
 * sampai diubah: kalau owner tutup malam ini, besok pagi tetap TUTUP sampai
 * dibuka manual oleh owner ATAU lewat jadwal auto-buka.
 */

export const STORE_STATUS = {
  OPEN: "OPEN",
  CLOSED: "CLOSED",
} as const;

export type StoreStatusValue =
  (typeof STORE_STATUS)[keyof typeof STORE_STATUS];

export const STORE_STATUS_KEYS = {
  status: "storeOperationalStatus",
  closedAt: "storeClosedAt",
  autoOpenEnabled: "storeAutoOpenEnabled",
  autoOpenTime: "storeAutoOpenTime",
} as const;

export type StoreStatus = {
  status: StoreStatusValue;
  isOpen: boolean;
  closedAt: string | null;
  autoOpenEnabled: boolean;
  /** Jam buka otomatis dalam format "HH:MM" (24 jam). */
  autoOpenTime: string;
};

const DEFAULT_AUTO_OPEN_TIME = "08:00";
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string) {
  return TIME_PATTERN.test(value);
}

/**
 * Ambang waktu auto-buka untuk "hari ini" berdasarkan jam yang diset.
 * Contoh: autoOpenTime "08:00" -> hari ini pukul 08:00 waktu lokal server.
 */
function autoOpenThreshold(time: string, now: Date) {
  const [hour, minute] = time.split(":").map((part) => Number(part));
  const threshold = new Date(now);
  threshold.setHours(hour, minute, 0, 0);

  return threshold;
}

async function readRawSettings() {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          STORE_STATUS_KEYS.status,
          STORE_STATUS_KEYS.closedAt,
          STORE_STATUS_KEYS.autoOpenEnabled,
          STORE_STATUS_KEYS.autoOpenTime,
        ],
      },
    },
  });

  const map = new Map(rows.map((row) => [row.key, row.value ?? ""]));

  const rawStatus = map.get(STORE_STATUS_KEYS.status);
  const autoOpenTimeRaw = map.get(STORE_STATUS_KEYS.autoOpenTime) ?? "";

  return {
    status:
      rawStatus === STORE_STATUS.CLOSED
        ? STORE_STATUS.CLOSED
        : STORE_STATUS.OPEN,
    closedAt: map.get(STORE_STATUS_KEYS.closedAt) || null,
    autoOpenEnabled: map.get(STORE_STATUS_KEYS.autoOpenEnabled) === "true",
    autoOpenTime: isValidTime(autoOpenTimeRaw)
      ? autoOpenTimeRaw
      : DEFAULT_AUTO_OPEN_TIME,
  };
}

function shouldAutoOpen(
  raw: Awaited<ReturnType<typeof readRawSettings>>,
  now: Date,
) {
  if (raw.status !== STORE_STATUS.CLOSED || !raw.autoOpenEnabled) {
    return false;
  }

  const threshold = autoOpenThreshold(raw.autoOpenTime, now);

  // Sudah lewat jam buka hari ini?
  if (now < threshold) {
    return false;
  }

  // Toko ditutup SEBELUM ambang buka hari ini (mis. tutup tadi malam).
  // Kalau ditutup setelah jam buka hari ini, jangan auto-buka di hari yang sama.
  if (!raw.closedAt) {
    return true;
  }

  const closedAt = new Date(raw.closedAt);

  return Number.isNaN(closedAt.getTime()) || closedAt < threshold;
}

/**
 * Status toko yang sudah diselesaikan (resolved): bila kondisi auto-buka
 * terpenuhi, status TUTUP otomatis dijadikan BUKA dan dicatat.
 */
export async function getStoreStatus(): Promise<StoreStatus> {
  const raw = await readRawSettings();

  if (shouldAutoOpen(raw, new Date())) {
    await applyOpen(null, "AUTO_OPEN");

    return {
      status: STORE_STATUS.OPEN,
      isOpen: true,
      closedAt: null,
      autoOpenEnabled: raw.autoOpenEnabled,
      autoOpenTime: raw.autoOpenTime,
    };
  }

  return {
    status: raw.status,
    isOpen: raw.status === STORE_STATUS.OPEN,
    closedAt: raw.closedAt,
    autoOpenEnabled: raw.autoOpenEnabled,
    autoOpenTime: raw.autoOpenTime,
  };
}

/** Versi ringan tanpa efek samping bila hanya butuh boolean buka/tutup. */
export async function isStoreOpen() {
  const status = await getStoreStatus();

  return status.isOpen;
}

/**
 * Guard API untuk aksi operasional. Mengembalikan `null` bila toko BUKA,
 * atau response 423 (Locked) bila TUTUP. Dipakai di endpoint tulis agar
 * kuncian tidak bisa diakali lewat request langsung.
 */
export async function guardStoreOpen() {
  if (await isStoreOpen()) {
    return null;
  }

  return NextResponse.json(
    {
      message:
        "Toko sedang tutup. Buka toko terlebih dahulu untuk melakukan operasional.",
    },
    { status: 423 },
  );
}

async function upsertSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

async function applyOpen(userId: number | null, _reason: "MANUAL" | "AUTO_OPEN") {
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: STORE_STATUS_KEYS.status },
      update: { value: STORE_STATUS.OPEN },
      create: { key: STORE_STATUS_KEYS.status, value: STORE_STATUS.OPEN },
    }),
    prisma.setting.upsert({
      where: { key: STORE_STATUS_KEYS.closedAt },
      update: { value: "" },
      create: { key: STORE_STATUS_KEYS.closedAt, value: "" },
    }),
  ]);
  void userId;
}

/** Tandai toko BUKA (dipakai tombol "Buka Toko" oleh owner). */
export async function openStore(userId: number) {
  await applyOpen(userId, "MANUAL");

  return getStoreStatus();
}

/** Tandai toko TUTUP (dipanggil saat closing berhasil). */
export async function closeStore(closedAt: Date = new Date()) {
  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: STORE_STATUS_KEYS.status },
      update: { value: STORE_STATUS.CLOSED },
      create: { key: STORE_STATUS_KEYS.status, value: STORE_STATUS.CLOSED },
    }),
    prisma.setting.upsert({
      where: { key: STORE_STATUS_KEYS.closedAt },
      update: { value: closedAt.toISOString() },
      create: {
        key: STORE_STATUS_KEYS.closedAt,
        value: closedAt.toISOString(),
      },
    }),
  ]);
}

/** Simpan preferensi auto-buka (dipakai halaman Pengaturan). */
export async function updateAutoOpen(input: {
  enabled: boolean;
  time?: string;
}) {
  await upsertSetting(
    STORE_STATUS_KEYS.autoOpenEnabled,
    input.enabled ? "true" : "false",
  );

  if (input.time !== undefined && isValidTime(input.time)) {
    await upsertSetting(STORE_STATUS_KEYS.autoOpenTime, input.time);
  }

  return getStoreStatus();
}
