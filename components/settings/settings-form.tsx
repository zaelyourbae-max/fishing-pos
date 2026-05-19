"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Code2,
  CreditCard,
  Info,
  Landmark,
  QrCode,
  Save,
  Store,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";

type SettingsFormProps = {
  settings: {
    storeName: string;
    storeWhatsApp: string;
    storeAddress: string;
    ownerName: string;
  };
  paymentMethods: {
    id: string;
    code: string;
    name: string;
    type: string;
    isActive: boolean;
  }[];
  paymentSettings: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountOwner: string;
    qrisImageUrl: string;
  };
  ownerEmail: string;
  appVersion: string;
};

const TOKEN_KEY = "fishing_pos_token";

function methodIcon(type: string) {
  if (type === "QRIS") {
    return <QrCode className="h-6 w-6" />;
  }

  if (type === "BANK_TRANSFER") {
    return <Landmark className="h-6 w-6" />;
  }

  return <Wallet className="h-6 w-6" />;
}

function methodDescription(type: string) {
  if (type === "QRIS") {
    return "Pembayaran menggunakan QR Code.";
  }

  if (type === "BANK_TRANSFER") {
    return "Pembayaran melalui transfer bank.";
  }

  return "Pembayaran tunai di toko.";
}

export default function SettingsForm({
  settings,
  paymentMethods,
  paymentSettings,
  ownerEmail,
  appVersion,
}: SettingsFormProps) {
  const router = useRouter();
  const qrisInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState(settings);
  const [paymentForm, setPaymentForm] = useState(paymentSettings);
  const [methods, setMethods] = useState(paymentMethods);
  const [savingAll, setSavingAll] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [methodLoading, setMethodLoading] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function authHeaders(contentType = "application/json") {
    const token =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(TOKEN_KEY) ?? "";

    return {
      Accept: "application/json",
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function saveSettings() {
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message ?? "Gagal menyimpan profil toko.");
    }
  }

  async function savePaymentSettings(nextPaymentForm = paymentForm) {
    const response = await fetch("/api/payment-settings", {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(nextPaymentForm),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message ?? "Gagal menyimpan payment settings.");
    }
  }

  async function saveAllSettings() {
    setSavingAll(true);
    setMessage("");
    setError("");

    try {
      await saveSettings();
      await savePaymentSettings();
      setMessage("Semua pengaturan berhasil disimpan.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menyimpan pengaturan.",
      );
    } finally {
      setSavingAll(false);
    }
  }

  async function toggleMethod(code: string, isActive: boolean) {
    setMethodLoading(code);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/payment-methods", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          code,
          isActive,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal update metode pembayaran.");
      }

      setMethods((current) =>
        current.map((method) =>
          method.code === code ? { ...method, isActive } : method,
        ),
      );
      setMessage("Status metode pembayaran berhasil diupdate.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal update metode pembayaran.",
      );
    } finally {
      setMethodLoading("");
    }
  }

  async function uploadQris(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token =
        typeof window === "undefined"
          ? ""
          : window.localStorage.getItem(TOKEN_KEY) ?? "";
      const response = await fetch("/api/payment-settings/qris-upload", {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal upload QRIS.");
      }

      setPaymentForm((current) => ({
        ...current,
        qrisImageUrl: data.data?.qrisImageUrl ?? "",
      }));
      setMessage("QRIS berhasil diupload.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Gagal upload QRIS.",
      );
    } finally {
      setUploadLoading(false);
      event.target.value = "";
    }
  }

  async function deleteQris() {
    setMessage("");
    setError("");

    try {
      const nextPaymentForm = {
        ...paymentForm,
        qrisImageUrl: "",
      };
      await savePaymentSettings(nextPaymentForm);
      setPaymentForm(nextPaymentForm);
      setMessage("QRIS berhasil dihapus.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Gagal hapus QRIS.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">Pengaturan</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium text-slate-500 dark:text-slate-400 sm:text-base">
            Atur konfigurasi toko, pembayaran, dan informasi sistem.
          </p>
        </div>

        <button
          type="button"
          onClick={saveAllSettings}
          disabled={savingAll}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          <Save className="h-5 w-5" />
          {savingAll ? "Menyimpan..." : "Simpan Semua Pengaturan"}
        </button>
      </div>

      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
            <Store className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              Informasi Toko
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Profil dasar yang dipakai untuk laporan dan pesan transaksi.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Nama Toko
            </span>
            <input
              value={form.storeName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  storeName: event.target.value,
                }))
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Nama toko"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Nomor WhatsApp
            </span>
            <input
              value={form.storeWhatsApp}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  storeWhatsApp: event.target.value,
                }))
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Nomor WhatsApp toko"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Nama Owner
            </span>
            <input
              value={form.ownerName}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  ownerName: event.target.value,
                }))
              }
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Nama owner"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              Email Owner
            </span>
            <input
              value={ownerEmail}
              readOnly
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            Alamat Toko
          </span>
          <textarea
            value={form.storeAddress}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                storeAddress: event.target.value,
              }))
            }
            className="mt-2 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Alamat toko"
          />
        </label>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-8 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
              <Banknote className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                Transfer Bank
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Informasi rekening untuk pembayaran via transfer.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Bank
              </span>
              <input
                value={paymentForm.bankName}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    bankName: event.target.value,
                  }))
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="BCA"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Nomor Rekening
              </span>
              <input
                value={paymentForm.bankAccountNumber}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    bankAccountNumber: event.target.value,
                  }))
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="19128888888"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Atas Nama
              </span>
              <input
                value={paymentForm.bankAccountOwner}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    bankAccountOwner: event.target.value,
                  }))
                }
                className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Nama pemilik rekening"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
              <QrCode className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                QRIS Statis
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Upload QR Code untuk pembayaran QRIS.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <button
              type="button"
              onClick={() => qrisInputRef.current?.click()}
              disabled={uploadLoading}
              className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              <Upload className="h-9 w-9 text-teal-600 dark:text-teal-300" />
              <span className="mt-4 rounded-xl border border-teal-200 px-5 py-2 text-sm font-bold text-teal-700 dark:border-teal-500/30 dark:text-teal-200">
                {uploadLoading ? "Mengupload..." : "Pilih Gambar"}
              </span>
              <span className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                PNG, JPG maks. 2MB
              </span>
            </button>

            <input
              ref={qrisInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={uploadQris}
              disabled={uploadLoading}
              className="hidden"
            />

            {paymentForm.qrisImageUrl ? (
              <div
                className="min-h-40 rounded-xl border border-slate-200 bg-white bg-contain bg-center bg-no-repeat p-2 dark:border-slate-800"
                role="img"
                aria-label="Preview QRIS"
                style={{
                  backgroundImage: `url("${paymentForm.qrisImageUrl}")`,
                }}
              />
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                Belum ada QRIS
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
            <CreditCard className="h-5 w-5 shrink-0 text-slate-500" />
            <input
              value={paymentForm.qrisImageUrl}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  qrisImageUrl: event.target.value,
                }))
              }
              className="min-h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none dark:text-slate-200"
              placeholder="/uploads/qris/file.png"
            />
            <button
              type="button"
              onClick={deleteQris}
              disabled={!paymentForm.qrisImageUrl}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-100 text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
              aria-label="Hapus QRIS"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
            <CreditCard className="h-6 w-6" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              Metode Pembayaran
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Aktifkan metode pembayaran yang tersedia di POS.
            </p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {methods.map((method) => (
            <div
              key={method.id}
              className="flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200">
                  {methodIcon(method.type)}
                </span>
                <div className="min-w-0">
                  <h3 className="break-words text-base font-bold text-slate-950 dark:text-slate-50">
                    {method.name}
                  </h3>
                  <p className="mt-1 break-words text-sm text-slate-500 dark:text-slate-400">
                    {methodDescription(method.type)}
                  </p>
                </div>
              </div>

              <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
                <span
                  className={
                    method.isActive
                      ? "rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 dark:bg-teal-500/10 dark:text-teal-200"
                      : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  }
                >
                  {method.isActive ? "Aktif" : "Nonaktif"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleMethod(method.code, !method.isActive)}
                  disabled={methodLoading === method.code}
                  className={
                    method.isActive
                      ? "relative h-8 w-14 rounded-full bg-teal-600 shadow-inner transition-colors disabled:opacity-60"
                      : "relative h-8 w-14 rounded-full bg-slate-300 shadow-inner transition-colors disabled:opacity-60 dark:bg-slate-700"
                  }
                  aria-label={`${method.isActive ? "Nonaktifkan" : "Aktifkan"} ${method.name}`}
                >
                  <span
                    className={
                      method.isActive
                        ? "absolute right-1 top-1 h-6 w-6 rounded-full bg-white shadow"
                        : "absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow"
                    }
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300">
              <Code2 className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              Developer / Credit
            </h2>
          </div>
          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <p>Developer: Akbar Fahreza</p>
            <p>a.k.a Alexander Van Meijr</p>
            <p>Powered by Meijrverse</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 dark:border-slate-800 dark:text-slate-300">
              <Info className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
              System Info
            </h2>
          </div>
          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
            <p>App version: {appVersion}</p>
            <p>Stack: Next.js + Prisma + PostgreSQL</p>
          </div>
        </section>
      </div>
    </div>
  );
}
