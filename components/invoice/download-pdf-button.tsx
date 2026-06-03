"use client";

type DownloadPdfButtonProps = {
  invoiceId: string;
};

export default function DownloadPdfButton({ invoiceId }: DownloadPdfButtonProps) {
  function handleClick() {
    const win = window.open(`/invoices/${invoiceId}?print=1`, "_blank");
    if (!win) {
      window.location.href = `/invoices/${invoiceId}?print=1`;
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 print:hidden"
    >
      Download PDF
    </button>
  );
}
