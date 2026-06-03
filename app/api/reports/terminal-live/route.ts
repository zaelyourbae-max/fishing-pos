import { requireOwner } from "@/lib/auth-session";
import { getTerminalLive } from "@/lib/analytics-terminal";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function startOfDay(d: Date) { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; }
function endOfDay(d: Date) { const n = new Date(d); n.setHours(23, 59, 59, 999); return n; }
function parseDate(v: string | null, fallback: Date) {
  if (!v || !DATE_PATTERN.test(v)) return fallback;
  const parsed = new Date(`${v}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

// Polling Mode Live: kembalikan deret transaksi terbaru untuk periode terpilih.
export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const rawFrom = parseDate(url.searchParams.get("from"), monthStart);
  const rawTo = parseDate(url.searchParams.get("to"), today);
  const from = startOfDay(rawFrom > today ? today : rawFrom);
  const to = endOfDay(rawTo > today ? today : rawTo < from ? from : rawTo);

  const points = await getTerminalLive({ from, to });
  return NextResponse.json({ points }, { headers: { "Cache-Control": "no-store" } });
}
