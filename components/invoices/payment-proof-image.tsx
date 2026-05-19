"use client";

import { FileImage } from "lucide-react";
import { useState } from "react";

type PaymentProofImageProps = {
  src: string;
};

export default function PaymentProofImage({ src }: PaymentProofImageProps) {
  const [imageError, setImageError] = useState(false);

  if (!src || imageError) {
    return (
      <div className="flex min-h-48 w-full items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center text-sm font-medium text-zinc-500">
        <div className="flex max-w-xs flex-col items-center gap-3">
          <FileImage className="h-8 w-8 text-zinc-400" />
          <span>Bukti pembayaran tidak tersedia atau gagal dimuat.</span>
        </div>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Bukti pembayaran QRIS"
      onError={() => setImageError(true)}
      className="max-h-64 w-full rounded-xl border border-zinc-200 bg-white object-contain p-2"
    />
  );
}
