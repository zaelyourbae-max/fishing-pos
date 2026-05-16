"use client";

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

type PaymentConfirmationModalProps = {
  open: boolean;
  paymentMethod: PaymentMethod | undefined;
  paymentSettings: PaymentSettings;
  total: number;
  paidAmount: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function rupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function PaymentConfirmationModal({
  open,
  paymentMethod,
  paymentSettings,
  total,
  paidAmount,
  loading,
  onConfirm,
  onCancel,
}: PaymentConfirmationModalProps) {
  if (!open || !paymentMethod) {
    return null;
  }

  const isQris = paymentMethod.type === "QRIS";
  const isTransfer = paymentMethod.type === "BANK_TRANSFER";
  const isCash = paymentMethod.type === "CASH";
  const change = Math.max(paidAmount - total, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-md dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 sm:p-7">
        <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Menunggu pembayaran
          </p>
          <h2 className="mt-1 font-sans text-2xl font-semibold">
            {isQris
              ? "Pembayaran QRIS"
              : isTransfer
                ? "Pembayaran Transfer Bank"
                : "Pembayaran Cash"}
          </h2>
        </div>

        <div className="py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-slate-800 dark:bg-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total yang harus dibayar</p>
            <p className="metric-value mt-2 text-3xl sm:text-4xl">{rupiah(total)}</p>
          </div>

          {isQris ? (
            <div className="mt-5 text-center">
              {paymentSettings.qrisImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={paymentSettings.qrisImageUrl}
                  alt="QRIS pembayaran"
                  className="mx-auto h-[min(70vw,360px)] w-[min(70vw,360px)] rounded-2xl border border-slate-200 bg-white object-contain p-3"
                />
              ) : (
                <div className="mx-auto flex h-72 w-72 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  QRIS belum disetting
                </div>
              )}
              <p className="mx-auto mt-4 max-w-lg text-sm text-slate-600 dark:text-slate-300">
                Minta customer scan QRIS, lalu klik Pembayaran Diterima setelah
                pembayaran dikonfirmasi manual.
              </p>
            </div>
          ) : null}

          {isTransfer ? (
            <div className="mt-5 rounded-2xl border border-teal-200 bg-teal-50 p-5 text-teal-950 dark:border-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
              <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">
                Rekening tujuan
              </p>
              <div className="mt-3 space-y-2 text-lg">
                <p>
                  <span className="text-sm text-teal-700 dark:text-teal-300">Bank</span>
                  <br />
                  <b>{paymentSettings.bankName}</b>
                </p>
                <p>
                  <span className="text-sm text-teal-700 dark:text-teal-300">Nomor rekening</span>
                  <br />
                  <b className="text-2xl tracking-wide tabular-nums">
                    {paymentSettings.bankAccountNumber}
                  </b>
                </p>
                <p>
                  <span className="text-sm text-teal-700 dark:text-teal-300">Atas nama</span>
                  <br />
                  <b>{paymentSettings.bankAccountOwner}</b>
                </p>
              </div>
              <p className="mt-4 text-sm text-teal-800 dark:text-teal-200">
                Minta customer transfer sesuai total, lalu klik Pembayaran
                Diterima setelah bukti/transfer dikonfirmasi.
              </p>
            </div>
          ) : null}

          {isCash ? (
            <div className="mt-5 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Dibayar</span>
                <span className="metric-value text-2xl">{rupiah(paidAmount)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Kembalian</span>
                <span className="metric-value text-2xl">{rupiah(change)}</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="min-h-10 rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition-colors duration-200 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="min-h-10 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-teal-700 disabled:opacity-60 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400"
          >
            {loading
              ? "Memproses..."
              : isCash
                ? "Selesaikan Transaksi"
                : "Pembayaran Diterima"}
          </button>
        </div>
      </div>
    </div>
  );
}
