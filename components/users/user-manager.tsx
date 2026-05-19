"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Crown,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  UserCheck,
  Users,
} from "lucide-react";
import LocalLiveSearchInput from "@/components/search/local-live-search-input";

type RoleSlug = "owner" | "cashier" | "developer";
type StatusFilter = "all" | "active" | "inactive";

type UserRow = {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  role: {
    name: string;
    slug: string;
  };
};

type UserManagerProps = {
  users: UserRow[];
};

type FormState = {
  id: number;
  name: string;
  email: string;
  role: RoleSlug;
  password: string;
  isActive: boolean;
};

const TOKEN_KEY = "fishing_pos_token";
const PAGE_SIZE = 5;

const roleOptions: { value: RoleSlug; label: string }[] = [
  { value: "developer", label: "Developer" },
  { value: "owner", label: "Owner" },
  { value: "cashier", label: "Cashier" },
];

function emptyForm(): FormState {
  return {
    id: 0,
    name: "",
    email: "",
    role: "cashier",
    password: "",
    isActive: true,
  };
}

function roleLabel(slug: string) {
  return roleOptions.find((role) => role.value === slug)?.label ?? slug;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function roleBadgeClass(slug: string) {
  if (slug === "developer") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200";
  }

  if (slug === "owner") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200";
  }

  return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200";
}

function avatarClass(slug: string) {
  if (slug === "developer") {
    return "bg-gradient-to-br from-emerald-500 to-teal-700 text-white";
  }

  if (slug === "owner") {
    return "bg-violet-100 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/20 dark:text-violet-100 dark:ring-violet-400/30";
  }

  return "bg-cyan-100 text-cyan-700 ring-1 ring-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-100 dark:ring-cyan-400/30";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function UserManager({ users }: UserManagerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleSlug | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [modalOpen, setModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isEditing = form.id > 0;
  const handleSearch = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);

  const stats = useMemo(
    () => ({
      total: users.length,
      activeCashiers: users.filter(
        (user) => user.role.slug === "cashier" && user.isActive,
      ).length,
      owners: users.filter((user) => user.role.slug === "owner").length,
      developers: users.filter((user) => user.role.slug === "developer").length,
    }),
    [users],
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        user.name.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.role.slug.toLowerCase().includes(normalizedQuery) ||
        user.role.name.toLowerCase().includes(normalizedQuery);
      const matchesRole =
        roleFilter === "all" || user.role.slug === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.isActive : !user.isActive);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function authHeaders() {
    const token =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(TOKEN_KEY) ?? "";

    return {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  async function request(method: "POST" | "PATCH", body: object) {
    const response = await fetch("/api/users", {
      method,
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data?.message ?? "Request user gagal.");
    }
  }

  function clearAlerts() {
    setMessage("");
    setError("");
  }

  function openCreate() {
    clearAlerts();
    setForm(emptyForm());
    setModalOpen(true);
  }

  function openEdit(user: UserRow) {
    clearAlerts();
    setOpenMenuId(null);
    setForm({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.slug as RoleSlug,
      password: "",
      isActive: user.isActive,
    });
    setModalOpen(true);
  }

  function resetFilters() {
    setQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  function applyCardFilter(role: RoleSlug | "all", status: StatusFilter) {
    setQuery("");
    setRoleFilter(role);
    setStatusFilter(status);
    setPage(1);
  }

  async function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    clearAlerts();

    try {
      await request(isEditing ? "PATCH" : "POST", {
        id: form.id,
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password,
        ...(isEditing ? { isActive: form.isActive } : {}),
      });
      setModalOpen(false);
      setForm(emptyForm());
      setMessage(isEditing ? "User berhasil diupdate." : "User berhasil dibuat.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Request user gagal.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(user: UserRow) {
    const nextStatus = !user.isActive;
    const confirmed = window.confirm(
      nextStatus
        ? `Aktifkan user ${user.name}?`
        : `Nonaktifkan user ${user.name}?`,
    );

    if (!confirmed) {
      return;
    }

    setActionLoadingId(user.id);
    setOpenMenuId(null);
    clearAlerts();

    try {
      await request("PATCH", {
        id: user.id,
        isActive: nextStatus,
      });
      setMessage(nextStatus ? "User diaktifkan." : "User dinonaktifkan.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Update user gagal.",
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  const summaryCards = [
    {
      label: "Total User",
      value: stats.total,
      description: "Semua user terdaftar",
      icon: Users,
      className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15",
      active: roleFilter === "all" && statusFilter === "all",
      onClick: () => applyCardFilter("all", "all"),
    },
    {
      label: "Kasir Aktif",
      value: stats.activeCashiers,
      description: "User kasir aktif",
      icon: UserCheck,
      className: "bg-blue-50 text-blue-700 dark:bg-blue-500/15",
      active: roleFilter === "cashier" && statusFilter === "active",
      onClick: () => applyCardFilter("cashier", "active"),
    },
    {
      label: "Owner",
      value: stats.owners,
      description: "Akses penuh sistem",
      icon: Crown,
      className: "bg-violet-50 text-violet-700 dark:bg-violet-500/15",
      active: roleFilter === "owner",
      onClick: () => applyCardFilter("owner", "all"),
    },
    {
      label: "Developer",
      value: stats.developers,
      description: "Akses teknis sistem",
      icon: Code2,
      className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15",
      active: roleFilter === "developer",
      onClick: () => applyCardFilter("developer", "all"),
    },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="mt-3 text-slate-500 dark:text-slate-400">
            Kelola user dan role akses toko dengan mudah.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/10 transition hover:bg-teal-700 disabled:opacity-60 sm:min-w-40"
        >
          <Plus className="h-4 w-4" />
          Tambah User
        </button>
      </div>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <button
              key={card.label}
              type="button"
              onClick={card.onClick}
              className={`flex min-h-32 items-center gap-5 rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950/70 ${
                card.active
                  ? "border-teal-300 ring-2 ring-teal-100 dark:border-teal-500/50 dark:ring-teal-500/10"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <span
                className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${card.className}`}
              >
                <Icon className="h-7 w-7" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <span className="mt-1 block break-words text-2xl font-bold tabular-nums text-slate-950 dark:text-white">
                  {card.value}
                </span>
                <span className="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                  {card.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="grid gap-3 lg:grid-cols-[1fr_240px_240px_auto]">
          <LocalLiveSearchInput
            value={query}
            onSearch={handleSearch}
            placeholder="Cari nama, email, role..."
          />

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as RoleSlug | "all");
              setPage(1);
            }}
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
          >
            <option value="all">Semua Role</option>
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setPage(1);
            }}
            className="h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:text-slate-300 dark:hover:border-teal-500/60 dark:hover:text-teal-200"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Terakhir Update</th>
                <th className="px-5 py-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {visibleUsers.map((user) => (
                <tr key={user.id} className="text-sm">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarClass(
                          user.role.slug,
                        )}`}
                      >
                        {initials(user.name)}
                      </span>
                      <span>
                        <span className="block font-bold text-slate-950 dark:text-white">
                          {user.name}
                        </span>
                        <span className="mt-1 block text-slate-500 dark:text-slate-400">
                          {user.email}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass(
                        user.role.slug,
                      )}`}
                    >
                      {roleLabel(user.role.slug)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          user.isActive ? "bg-teal-500" : "bg-slate-400"
                        }`}
                      />
                      {user.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                    {formatDate(user.updatedAt)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="relative flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:text-slate-300 dark:hover:border-teal-500/60 dark:hover:text-teal-200"
                        aria-label={`Edit ${user.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuId(openMenuId === user.id ? null : user.id)
                        }
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-teal-300 hover:text-teal-700 dark:border-slate-800 dark:text-slate-300 dark:hover:border-teal-500/60 dark:hover:text-teal-200"
                        aria-label={`Menu aksi ${user.name}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === user.id ? (
                        <div className="absolute right-0 top-12 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
                          <button
                            type="button"
                            onClick={() => openEdit(user)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
                          >
                            Edit detail
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === user.id}
                            onClick={() => toggleActive(user)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-900"
                          >
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {visibleUsers.length === 0 ? (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-slate-500" colSpan={5}>
                    Tidak ada user yang cocok dengan filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
          {visibleUsers.map((user) => (
            <div key={user.id} className="p-4">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${avatarClass(
                    user.role.slug,
                  )}`}
                >
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-950 dark:text-white">
                    {user.name}
                  </p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {user.email}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${roleBadgeClass(
                        user.role.slug,
                      )}`}
                    >
                      {roleLabel(user.role.slug)}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          user.isActive ? "bg-teal-500" : "bg-slate-400"
                        }`}
                      />
                      {user.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Terakhir update: {formatDate(user.updatedAt)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => openEdit(user)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={actionLoadingId === user.id}
                  onClick={() => toggleActive(user)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-60 dark:border-slate-800 dark:text-slate-300"
                >
                  {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))}
          {visibleUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Tidak ada user yang cocok dengan filter.
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Menampilkan{" "}
            {filteredUsers.length === 0
              ? "0"
              : `${(currentPage - 1) * PAGE_SIZE + 1} - ${Math.min(
                  currentPage * PAGE_SIZE,
                  filteredUsers.length,
                )}`}{" "}
            dari {filteredUsers.length} user
          </p>
          <div className="flex max-w-full flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="h-10 w-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300"
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map(
              (pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`h-10 w-10 rounded-xl border text-sm font-semibold ${
                    pageNumber === currentPage
                      ? "border-teal-500 text-teal-700 dark:text-teal-200"
                      : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300"
                  }`}
                >
                  {pageNumber}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
              className="h-10 w-10 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 disabled:opacity-40 dark:border-slate-800 dark:text-slate-300"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
          <form
            onSubmit={submitUser}
            className="max-h-[100dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950 dark:text-white">
                  {isEditing ? "Edit User" : "Tambah User"}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Role tersedia: Developer, Owner, dan Cashier.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Tutup
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Nama
                </span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
                  placeholder="Nama user"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
                  placeholder="email@toko.local"
                  required
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Role
                </span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as RoleSlug,
                    }))
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Password
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-teal-500/10"
                  placeholder={isEditing ? "Kosongkan jika tidak diganti" : "Password"}
                  required={!isEditing}
                />
              </label>
            </div>

            {isEditing ? (
              <label className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-800">
                <span>
                  <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Status User
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    User aktif bisa login sesuai role.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked,
                    }))
                  }
                  className="h-5 w-5 accent-teal-600"
                />
              </label>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="h-12 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-600 px-5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {loading
                  ? "Menyimpan..."
                  : isEditing
                    ? "Update User"
                    : "Simpan User"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
