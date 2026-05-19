"use client";

const TOKEN_KEY = "fishing_pos_token";

function filenameFromContentDisposition(value: string | null) {
  if (!value) {
    return null;
  }

  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1].trim().replaceAll('"', ""));
  }

  const match = value.match(/filename="?([^";]+)"?/i);

  return match?.[1]?.trim() ?? null;
}

async function errorMessage(response: Response) {
  const payload = await response.json().catch(() => null);

  if (payload && typeof payload === "object" && "message" in payload) {
    return String(payload.message);
  }

  return response.status === 401
    ? "Session tidak valid. Silakan login ulang."
    : "Export PDF gagal.";
}

export async function downloadOwnerReportPdf(
  href: string,
  fallbackFilename: string,
) {
  const token =
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(TOKEN_KEY) ?? "";
  const response = await fetch(href, {
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/pdf",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/pdf")) {
    throw new Error("Response export bukan file PDF.");
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    filenameFromContentDisposition(response.headers.get("content-disposition")) ??
    fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
