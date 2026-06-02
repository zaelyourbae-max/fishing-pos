import AnalyticsTerminalPreview from "@/components/reports/analytics-terminal-preview";
import { getTerminalKpis, getTerminalSeries } from "@/lib/analytics-terminal";
import { requireOwnerPage } from "@/lib/page-guards";

export const metadata = {
  title: "Preview Mode Analitik",
};

type PageProps = {
  searchParams?: Promise<{ from?: string; to?: string }>;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function parseInputDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function ReportsPreviewPage({ searchParams }: PageProps) {
  await requireOwnerPage();

  const params = (await searchParams) ?? {};
  const today = startOfDay(new Date());
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const rawFrom = parseInputDate(params.from, monthStart);
  const rawTo = parseInputDate(params.to, today);
  // clamp: tidak melebihi hari ini, dan from <= to
  const from = startOfDay(rawFrom > today ? today : rawFrom);
  const to = endOfDay(rawTo > today ? today : rawTo < from ? from : rawTo);

  const [kpis, chart] = await Promise.all([
    getTerminalKpis({ from, to }),
    getTerminalSeries(),
  ]);

  return (
    <AnalyticsTerminalPreview
      kpis={kpis}
      chart={chart}
      period={{ from: params.from ?? toInput(from), to: params.to ?? toInput(to) }}
    />
  );
}

function toInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
