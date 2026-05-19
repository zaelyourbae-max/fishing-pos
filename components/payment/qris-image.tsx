"use client";

import { QrCode } from "lucide-react";
import { useState } from "react";

import { resolveQrisImageUrl } from "@/lib/qris-image";

type QrisImageProps = {
  qrisImageUrl: string;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export default function QrisImage({
  qrisImageUrl,
  alt = "QRIS pembayaran",
  className = "",
  imageClassName = "",
  fallbackClassName = "",
}: QrisImageProps) {
  const imageUrl = resolveQrisImageUrl(qrisImageUrl);
  const [failedUrl, setFailedUrl] = useState("");
  const showFallback = !imageUrl || failedUrl === imageUrl;

  if (showFallback) {
    return (
      <div
        className={
          fallbackClassName ||
          "flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
        }
      >
        <div className="flex max-w-xs flex-col items-center gap-3">
          <QrCode className="h-8 w-8 text-slate-400" />
          <span>QRIS belum tersedia. Upload QRIS di Pengaturan.</span>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        onError={() => setFailedUrl(imageUrl)}
        className={imageClassName}
      />
    </div>
  );
}
