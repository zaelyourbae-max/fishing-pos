"use client";

type PrintInvoiceButtonProps = {
  label?: string;
};

export default function PrintInvoiceButton({
  label = "Print Invoice",
}: PrintInvoiceButtonProps) {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 print:hidden"
      type="button"
    >
      {label}
    </button>
  );
}
