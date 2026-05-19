"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TOKEN_KEY = "fishing_pos_token";

export default function SupplierForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("SUPPLIER");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const token =
        typeof window === "undefined"
          ? ""
          : window.localStorage.getItem(TOKEN_KEY) ?? "";
      const response = await fetch("/api/suppliers", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          type,
          phone,
          address,
          notes,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.message ?? "Gagal membuat supplier.");
      }

      setName("");
      setType("SUPPLIER");
      setPhone("");
      setAddress("");
      setNotes("");
      setMessage("Supplier berhasil ditambahkan.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal membuat supplier.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submitSupplier}
      className="surface-panel space-y-4 rounded-3xl p-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Tambah Supplier</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Data dasar supplier untuk pembelian stok.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nama</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Nama supplier"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Type</label>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
          >
            <option value="SUPPLIER">Supplier</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telepon</label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Opsional"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alamat</label>
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
          placeholder="Opsional"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
          placeholder="Opsional"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Menyimpan..." : "Simpan Supplier"}
      </button>
    </form>
  );
}
