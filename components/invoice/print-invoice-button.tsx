"use client";

type PrintInvoiceButtonProps = {
  label?: string;
  className?: string;
};

export default function PrintInvoiceButton({
  label = "Print Invoice",
  className = "rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 print:hidden",
}: PrintInvoiceButtonProps) {
  return (
    <button onClick={() => window.print()} className={className} type="button">
      {label}
    </button>
  );
}
