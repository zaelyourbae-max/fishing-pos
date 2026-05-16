"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import LocalLiveSearchInput from "@/components/search/local-live-search-input";

type Supplier = {
  id: number;
  code: string;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
};

type SupplierManagerProps = {
  suppliers: Supplier[];
};

const TOKEN_KEY = "fishing_pos_token";

function emptyForm() {
  return {
    id: 0,
    name: "",
    type: "SUPPLIER",
    phone: "",
    address: "",
    notes: "",
  };
}

export default function SupplierManager({ suppliers }: SupplierManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const isEditing = form.id > 0;
  const handleSearch = useCallback((value: string) => {
    setSearch(value);
  }, []);
  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) {
      return suppliers;
    }

    return suppliers.filter((supplier) =>
      [
        supplier.code,
        supplier.name,
        supplier.type,
        supplier.phone ?? "",
        supplier.address ?? "",
        supplier.notes ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [search, suppliers]);

  async function request(method: "POST" | "PATCH", body: object) {
    const token =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(TOKEN_KEY) ?? "";
    const response = await fetch("/api/suppliers", {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message ?? "Request supplier gagal.");
    }
  }

  async function submitSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await request(isEditing ? "PATCH" : "POST", form);
      setForm(emptyForm());
      setMessage(isEditing ? "Supplier berhasil diupdate." : "Supplier berhasil ditambahkan.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Request supplier gagal.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function deactivateSupplier(id: number) {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await request("PATCH", {
        id,
        isActive: false,
      });
      setMessage("Supplier berhasil dinonaktifkan.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Gagal menonaktifkan supplier.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={submitSupplier}
        className="surface-panel space-y-4 rounded-3xl p-5 sm:p-6"
      >
        <div>
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? "Edit Supplier" : "Tambah Supplier"}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Supplier aktif akan tersedia di form pembelian.
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
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Nama supplier"
          />
          <select
            value={form.type}
            onChange={(event) =>
              setForm((current) => ({ ...current, type: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="SUPPLIER">Supplier</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </select>
          <input
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
            placeholder="Telepon"
          />
        </div>

        <input
          value={form.address}
          onChange={(event) =>
            setForm((current) => ({ ...current, address: event.target.value }))
          }
          className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
          placeholder="Alamat"
        />

        <textarea
          value={form.notes}
          onChange={(event) =>
            setForm((current) => ({ ...current, notes: event.target.value }))
          }
          className="min-h-24 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 text-slate-900 outline-none dark:text-slate-100"
          placeholder="Notes"
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-teal-600 px-6 py-3 font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : isEditing ? "Update Supplier" : "Simpan Supplier"}
          </button>
          {isEditing ? (
            <button
              type="button"
              onClick={() => setForm(emptyForm())}
              className="rounded-2xl border border-slate-200 px-6 py-3 font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300"
            >
              Batal
            </button>
          ) : null}
        </div>
      </form>

      <div className="surface-panel overflow-hidden rounded-3xl">
        <div className="border-b border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-2xl font-bold text-white">Daftar Supplier Aktif</h2>
          <div className="mt-4">
            <LocalLiveSearchInput
              value={search}
              onSearch={handleSearch}
              placeholder="Cari supplier, distributor, telepon..."
            />
          </div>
        </div>

        <div className="table-scroll">
        <table className="data-table">
          <thead className="bg-[#060B1F] text-sm text-slate-400">
            <tr>
              <th className="p-4 text-left">Kode</th>
              <th className="p-4 text-left">Nama</th>
              <th className="p-4 text-left">Tipe</th>
              <th className="p-4 text-left">Telepon</th>
              <th className="p-4 text-left">Alamat</th>
              <th className="p-4 text-left">Notes</th>
              <th className="p-4 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.length === 0 ? (
              <tr>
                <td className="p-5 text-slate-400" colSpan={7}>
                  Tidak ada supplier yang cocok.
                </td>
              </tr>
            ) : null}

            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="p-4 text-slate-300">{supplier.code}</td>
                <td className="p-4 font-semibold text-white">{supplier.name}</td>
                <td className="p-4 text-slate-300">
                  {supplier.type === "DISTRIBUTOR" ? "Distributor" : "Supplier"}
                </td>
                <td className="p-4 text-slate-300">{supplier.phone ?? "-"}</td>
                <td className="p-4 text-slate-300">{supplier.address ?? "-"}</td>
                <td className="p-4 text-slate-300">{supplier.notes ?? "-"}</td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          id: supplier.id,
                          name: supplier.name,
                          type: supplier.type === "DISTRIBUTOR" ? "DISTRIBUTOR" : "SUPPLIER",
                          phone: supplier.phone ?? "",
                          address: supplier.address ?? "",
                          notes: supplier.notes ?? "",
                        })
                      }
                      className="text-sm font-semibold text-teal-700 dark:text-teal-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deactivateSupplier(supplier.id)}
                      className="text-sm font-semibold text-red-700 dark:text-red-400"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
