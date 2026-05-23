import { requireOwner } from "@/lib/auth-session";
import { formatDateID } from "@/lib/date-format";
import { serializeProfitSummary } from "@/lib/report-profit-detail";
import { getOwnerReportSummary, type OwnerReportRange } from "@/lib/reports";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const BUSINESS_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBusinessDate(value: string | null, end = false) {
  if (!value || !BUSINESS_DATE_PATTERN.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  if (end) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

function dateInputValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());

  return local.toISOString().slice(0, 10);
}

function formatDate(date: Date) {
  return formatDateID(date);
}

function todayRange(): OwnerReportRange {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

function resolveRange(searchParams: URLSearchParams) {
  const from = parseBusinessDate(searchParams.get("from"));
  const to = parseBusinessDate(searchParams.get("to"), true);

  if (!from || !to || from > to) {
    return todayRange();
  }

  return { from, to } satisfies OwnerReportRange;
}

function periodLabel(range: OwnerReportRange) {
  if (!range.from || !range.to) {
    return "Periode laporan";
  }

  if (dateInputValue(range.from) === dateInputValue(range.to)) {
    return formatDate(range.from);
  }

  return `${formatDate(range.from)} - ${formatDate(range.to)}`;
}

export async function GET(req: Request) {
  const auth = requireOwner(req);

  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(req.url);
  const range = resolveRange(url.searchParams);
  const report = await getOwnerReportSummary(range);

  return NextResponse.json(
    {
      period: {
        from: range.from ? dateInputValue(range.from) : "",
        to: range.to ? dateInputValue(range.to) : "",
        label: periodLabel(range),
      },
      profitSummary: serializeProfitSummary(report.profit),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
