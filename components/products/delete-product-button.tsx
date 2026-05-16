"use client";

import { Archive } from "lucide-react";
import { useState } from "react";

type DeleteProductButtonProps = {
  productId: number;
};

export default function DeleteProductButton({
  productId,
}: DeleteProductButtonProps) {
  const [isOwner] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const storedUser = window.localStorage.getItem("fishing_pos_user");
    if (!storedUser) {
      return false;
    }

    const user = JSON.parse(storedUser) as {
      role?: {
        slug?: string | null;
      } | null;
    };

    return user.role?.slug === "owner" || user.role?.slug === "developer";
  });

  async function handleDelete() {
    const confirmed = window.confirm(
      "Produk akan dinonaktifkan dan tidak muncul di POS. Riwayat transaksi tetap aman.",
    );

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/products/${productId}/archive`, {
      method: "PATCH",
    });

    if (response.ok) {
      window.location.reload();
    } else {
      alert("Gagal menonaktifkan produk");
    }
  }

  if (!isOwner) {
    return null;
  }

  return (
    <button
      onClick={handleDelete}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-500/40 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      type="button"
    >
      <Archive size={16} />
      Nonaktifkan
    </button>
  );
}
