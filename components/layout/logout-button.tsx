"use client";

const TOKEN_KEY = "fishing_pos_token";
const USER_KEY = "fishing_pos_user";

export default function LogoutButton() {
  async function logout() {
    try {
      await fetch("/api/logout", {
        method: "POST",
      });
    } finally {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
      window.location.href = "/login";
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-red-600 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-red-300"
    >
      Logout
    </button>
  );
}
