"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TerminalChartData, TerminalKpis, TerminalSpark } from "@/lib/analytics-terminal";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  GitCompareArrows,
  Minus,
  Sparkles,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   "Mode Analitik" ala Bloomberg / Binance.
   Variasi chart banyak, bisa mode TUNGGAL atau PERBANDINGAN, ada custom rentang,
   kartu 3D. DATA ASLI: kpis/chart datang dari props (lib/analytics-terminal).
   ────────────────────────────────────────────────────────────────────────── */

const C = {
  bg: "#0a0e17",
  panel: "#0d1320",
  panel2: "#111a2b",
  border: "#202c42",
  text: "#e6edf6",
  muted: "#8a97ab",
  up: "#16c784",
  down: "#ea3943",
  gold: "#f0b90b",
  income: "#38bdf8",
  expense: "#f43f5e",
  vol: "#334766",
};

// kartu 3D / nimbul
const card3d: React.CSSProperties = {
  background: "linear-gradient(180deg, #16203400 0%, transparent 60%), linear-gradient(180deg, #16213a 0%, #0d1320 72%)",
  border: `1px solid ${C.border}`,
  boxShadow: "0 16px 36px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
};
const inset: React.CSSProperties = {
  background: "linear-gradient(180deg, #0b1322, #0a0f1b)",
  border: `1px solid ${C.border}`,
  boxShadow: "inset 0 2px 10px rgba(0,0,0,0.45)",
};

type Style = "line" | "area" | "spike" | "bars" | "barline" | "volume";

const styleChoices: { v: Style; label: string }[] = [
  { v: "line", label: "Garis halus" },
  { v: "area", label: "Area gelombang" },
  { v: "spike", label: "Garis tajam" },
  { v: "bars", label: "Batang" },
  { v: "barline", label: "Batang + garis" },
  { v: "volume", label: "Garis + batang" },
];

/* ── KPI ticker ──────────────────────────────────────────────────────────── */
type Ticker = { name: string; value: string; changePct: number; goodWhen: "up" | "down" | "neutral"; high?: string; low?: string; spark?: number[]; sub?: string };

type Section = {
  id: string; title: string; rangeNote: string; unit: Unit;
  labels: string[]; income: number[]; expense: number[]; defaultStyle: Style;
  ranges: { label: string; count: number }[];
};

const UNIT_WORD: Record<string, string> = { jam: "Jam", harian: "Hari", mingguan: "Minggu", bulanan: "Bulan", tahunan: "Tahun" };
type Unit = "rb" | "jt" | "rp";
const unitVal = (v: number, u: Unit) => (u === "rb" ? v * 1000 : u === "jt" ? v * 1_000_000 : v);
function rpShort(n: number) {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)}M`;
  if (a >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (a >= 1_000) return `Rp ${Math.round(n / 1_000)}rb`;
  return `Rp ${Math.round(n)}`;
}

/* path mulus (catmull-rom → bezier) untuk gelombang */
function smooth(pts: [number, number][]) {
  if (pts.length < 3) return `M ${pts.map((p) => p.join(" ")).join(" L ")}`;
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

function Spark({ data, color }: { data: number[]; color: string }) {
  const w = 72, h = 26, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / span) * h}`).join(" ");
  return <svg width={w} height={h} className="overflow-visible"><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ── Chart serbaguna ────────────────────────────────────────────────────── */
function Chart({ style, labels, income, expense, unit, compare }: { style: Style; labels: string[]; income: number[]; expense: number[]; unit: Unit; compare: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const W = 760, H = 250, pad = { t: 18, r: 24, b: 28, l: 72 };
  const ih = H - pad.t - pad.b, n = labels.length;
  const gx0 = pad.l + 30, gx1 = W - pad.r - 16, iw = gx1 - gx0;
  const volTop = pad.t + ih * 0.72;
  const usesVol = style === "volume";
  const plotBottom = usesVol ? volTop - 6 : pad.t + ih;
  const plotH = plotBottom - pad.t;
  const both = compare;
  const max = Math.max(...income, ...(both ? expense : [0])) * 1.14 || 1;
  const x = (i: number) => (n === 1 ? (gx0 + gx1) / 2 : gx0 + (i / (n - 1)) * iw);
  const band = (i: number) => gx0 + (i + 0.5) * (iw / n);
  const cx = (i: number) => (style === "bars" ? band(i) : x(i));
  const y = (v: number) => pad.t + (1 - v / max) * plotH;
  const XY = (arr: number[]) => arr.map((v, i) => [x(i), y(v)] as [number, number]);
  const labelStep = Math.max(1, Math.ceil(n / 8));
  const bw = Math.max(5, (iw / n) * (both && (style === "bars" || style === "barline") ? 0.34 : 0.55));
  const volMax = Math.max(...(both ? expense : income)) * 1.2 || 1;
  const volY = (v: number) => pad.t + ih - (v / volMax) * (pad.t + ih - volTop);

  // Garis bantu + label sumbu pakai SATU set tick yang sama (biar sinkron).
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  // gaya bergaris (bukan batang murni) → boleh diberi titik & penanda ujung.
  const lineish = style === "line" || style === "spike" || style === "area" || style === "volume";
  const showDots = n > 1 && n <= 31; // titik per data, tapi jangan saat datanya rapat.
  const incW = 2.8, expW = 2.2; // pengeluaran sedikit lebih tipis → pemasukan jadi fokus.
  // ganti key → animasi "menggambar" terputar ulang tiap ganti gaya/periode.
  const animKey = `${style}-${both ? "c" : "s"}-${n}-${labels[0] ?? ""}-${labels[n - 1] ?? ""}`;

  function setFromX(clientX: number) {
    const r = wrap.current?.getBoundingClientRect(); if (!r) return;
    const frac = (((clientX - r.left) / r.width) * W - gx0) / iw;
    setHover(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  }

  const area = (arr: number[], fillId: string, strokeId: string, glow: string, w = incW) => (
    <>
      <path className="chart-fade" d={`${smooth(XY(arr))} L ${x(n - 1)} ${plotBottom} L ${gx0} ${plotBottom} Z`} fill={`url(#${fillId})`} />
      <path className="chart-fade" d={smooth(XY(arr))} fill="none" stroke={glow} strokeWidth={8} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      <path className="chart-line" pathLength={1} d={smooth(XY(arr))} fill="none" stroke={`url(#${strokeId})`} strokeWidth={w} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </>
  );

  return (
    <div ref={wrap} className="relative h-[210px] w-full select-none sm:h-[250px]" style={{ touchAction: "pan-y" }} onMouseMove={(e) => setFromX(e.clientX)} onMouseLeave={() => setHover(null)} onTouchStart={(e) => setFromX(e.touches[0].clientX)} onTouchMove={(e) => setFromX(e.touches[0].clientX)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.income} stopOpacity="0.28" /><stop offset="55%" stopColor={C.income} stopOpacity="0.07" /><stop offset="100%" stopColor={C.income} stopOpacity="0" /></linearGradient>
          <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.expense} stopOpacity="0.22" /><stop offset="55%" stopColor={C.expense} stopOpacity="0.05" /><stop offset="100%" stopColor={C.expense} stopOpacity="0" /></linearGradient>
          <linearGradient id="si" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9bdcff" /><stop offset="100%" stopColor="#2a9fe0" /></linearGradient>
          <linearGradient id="se" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffb3bd" /><stop offset="100%" stopColor="#e8455f" /></linearGradient>
          <linearGradient id="bi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6cccf7" stopOpacity="0.95" /><stop offset="100%" stopColor="#1f7fb8" stopOpacity="0.55" /></linearGradient>
          <linearGradient id="be" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb8392" stopOpacity="0.95" /><stop offset="100%" stopColor="#c52941" stopOpacity="0.55" /></linearGradient>
        </defs>

        {ticks.map((p, i) => <line key={i} x1={pad.l} y1={pad.t + p * plotH} x2={W - pad.r} y2={pad.t + p * plotH} stroke={C.border} strokeWidth={1} strokeOpacity={p === 1 ? 0.95 : 0.5} vectorEffect="non-scaling-stroke" strokeDasharray={p === 1 ? undefined : "2 7"} />)}
        {/* label sumbu dipindah ke HTML overlay (di bawah) supaya tidak distorsi di mobile */}

        <g key={animKey}>
        {(style === "bars" || style === "barline") ? labels.map((_, i) => (
          <g key={i} className="chart-rise" style={{ animationDelay: `${Math.min(i * 28, 420)}ms` }}>
            <rect x={both && style === "bars" ? cx(i) - bw - 1 : cx(i) - bw / 2} y={y(income[i])} width={bw} height={plotBottom - y(income[i])} rx={3} fill="url(#bi)" />
            {both && style === "bars" ? <rect x={cx(i) + 1} y={y(expense[i])} width={bw} height={plotBottom - y(expense[i])} rx={3} fill="url(#be)" /> : null}
          </g>
        )) : null}
        {style === "barline" ? <><path className="chart-fade" d={smooth(XY(both ? expense : income))} fill="none" stroke={both ? C.expense : C.gold} strokeWidth={8} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" strokeLinecap="round" /><path className="chart-line" pathLength={1} d={smooth(XY(both ? expense : income))} fill="none" stroke={both ? "url(#se)" : C.gold} strokeWidth={both ? expW : 2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></> : null}

        {style === "area" ? <>{area(income, "gi", "si", C.income)}{both ? area(expense, "ge", "se", C.expense, expW) : null}</> : null}
        {style === "line" ? <>
          <path className="chart-fade" d={smooth(XY(income))} fill="none" stroke={C.income} strokeWidth={8} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path className="chart-line" pathLength={1} d={smooth(XY(income))} fill="none" stroke="url(#si)" strokeWidth={incW} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          {both ? <><path className="chart-fade" d={smooth(XY(expense))} fill="none" stroke={C.expense} strokeWidth={8} strokeOpacity={0.10} vectorEffect="non-scaling-stroke" strokeLinecap="round" /><path className="chart-line" pathLength={1} d={smooth(XY(expense))} fill="none" stroke="url(#se)" strokeWidth={expW} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></> : null}
        </> : null}
        {style === "spike" ? <>
          <polyline className="chart-fade" points={XY(income).map((p) => p.join(",")).join(" ")} fill="none" stroke={C.income} strokeWidth={8} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <polyline className="chart-line" pathLength={1} points={XY(income).map((p) => p.join(",")).join(" ")} fill="none" stroke="url(#si)" strokeWidth={incW} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          {both ? <polyline className="chart-line" pathLength={1} points={XY(expense).map((p) => p.join(",")).join(" ")} fill="none" stroke="url(#se)" strokeWidth={expW} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /> : null}
        </> : null}

        {usesVol ? <>
          {(both ? expense : income).map((v, i) => <rect key={i} className="chart-rise" style={{ animationDelay: `${Math.min(i * 28, 420)}ms` }} x={x(i) - bw / 2} y={volY(v)} width={bw} height={pad.t + ih - volY(v)} rx={2} fill={both ? "url(#be)" : C.vol} opacity={both ? 0.6 : 0.65} />)}
          <path className="chart-fade" d={smooth(XY(income))} fill="none" stroke={C.income} strokeWidth={8} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path className="chart-line" pathLength={1} d={smooth(XY(income))} fill="none" stroke="url(#si)" strokeWidth={incW} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <line x1={pad.l} y1={volTop} x2={W - pad.r} y2={volTop} stroke={C.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </> : null}

        {/* titik per data — biar hari sepi/Rp 0 tetap kelihatan ada datanya */}
        {showDots && lineish ? XY(income).map(([px, py], i) => (
          <circle key={`di${i}`} className="chart-fade" cx={px} cy={py} r={2.4} fill={C.income} stroke={C.bg} strokeWidth={1} />
        )) : null}
        {showDots && lineish && both ? XY(expense).map(([px, py], i) => (
          <circle key={`de${i}`} className="chart-fade" cx={px} cy={py} r={2.4} fill={C.expense} stroke={C.bg} strokeWidth={1} />
        )) : null}

        {/* penanda titik terakhir (pemasukan) — supaya ujung garis tidak menggantung */}
        {lineish && n > 0 ? (
          <g className="chart-fade">
            <circle cx={x(n - 1)} cy={y(income[n - 1])} r={6} fill={C.income} opacity={0.18} />
            <circle cx={x(n - 1)} cy={y(income[n - 1])} r={3.2} fill={C.income} stroke={C.bg} strokeWidth={1.5} />
          </g>
        ) : null}
        </g>

        {hover !== null ? <>
          <line x1={cx(hover)} y1={pad.t} x2={cx(hover)} y2={pad.t + ih} stroke={C.muted} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          <circle cx={cx(hover)} cy={y(income[hover])} r={3.5} fill={C.income} stroke={C.bg} strokeWidth={1.5} />
          {both ? <circle cx={cx(hover)} cy={y(expense[hover])} r={3.5} fill={C.expense} stroke={C.bg} strokeWidth={1.5} /> : null}
        </> : null}
      </svg>

      {ticks.map((t, i) => (
        <span key={`y${i}`} className="pointer-events-none absolute z-[1] -translate-y-1/2 rounded px-1 text-xs font-semibold tabular-nums" style={{ left: 2, top: `${((pad.t + t * plotH) / H) * 100}%`, background: C.panel, color: "#aab6c9" }}>{rpShort(unitVal(max * (1 - t), unit))}</span>
      ))}
      {labels.map((lb, i) => (i % labelStep === 0 || i === n - 1) ? (
        <span key={`x${i}`} className="pointer-events-none absolute bottom-0 -translate-x-1/2 text-xs font-medium" style={{ left: `${(cx(i) / W) * 100}%`, color: "#aab6c9" }}>{lb}</span>
      ) : null)}

      {hover !== null ? (
        <div className="pointer-events-none absolute top-2 z-10 rounded-lg border px-3 py-2 text-sm shadow-xl" style={{ left: `${Math.min(88, Math.max(12, (cx(hover) / W) * 100))}%`, transform: "translateX(-50%)", background: C.panel2, borderColor: C.border, color: C.text }}>
          <p className="font-bold">{labels[hover]}</p>
          <p style={{ color: C.income }}>{compare ? "Pemasukan" : "Nilai"}: {rpShort(unitVal(income[hover], unit))}</p>
          {compare ? <><p style={{ color: C.expense }}>Pengeluaran: {rpShort(unitVal(expense[hover], unit))}</p><p className="font-semibold" style={{ color: income[hover] - expense[hover] >= 0 ? C.up : C.down }}>Selisih: {rpShort(unitVal(income[hover] - expense[hover], unit))}</p></> : null}
        </div>
      ) : null}
    </div>
  );
}

function changeColor(t: Ticker) {
  if (t.goodWhen === "neutral") return C.gold;
  return (t.goodWhen === "up" ? t.changePct >= 0 : t.changePct <= 0) ? C.up : C.down;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
function changePct(cur: number, prev: number) {
  if (prev > 0) return ((cur - prev) / prev) * 100;
  return cur > 0 ? 100 : 0;
}

function buildTickers(k: TerminalKpis, sp: TerminalSpark): Ticker[] {
  const c = k.current, p = k.previous;
  const atvSpark = sp.transactions.map((t, i) => (t > 0 ? Math.round(sp.grossRevenue[i] / t) : 0));
  const money = (name: string, goodWhen: Ticker["goodWhen"], cur: number, prev: number, spark: number[]): Ticker => ({ name, value: rpShort(cur), changePct: round1(changePct(cur, prev)), goodWhen, spark, sub: `Periode lalu ${rpShort(prev)}` });
  const count = (name: string, goodWhen: Ticker["goodWhen"], cur: number, prev: number, spark: number[]): Ticker => ({ name, value: cur.toLocaleString("id-ID"), changePct: round1(changePct(cur, prev)), goodWhen, spark, sub: `Periode lalu ${prev.toLocaleString("id-ID")}` });
  return [
    money("Omzet Bersih", "up", c.netRevenue, p.netRevenue, sp.netRevenue),
    money("Omzet Kotor", "up", c.grossRevenue, p.grossRevenue, sp.grossRevenue),
    count("Total Transaksi", "up", c.transactions, p.transactions, sp.transactions),
    count("Produk Terjual", "up", c.itemsSold, p.itemsSold, sp.itemsSold),
    money("Rata-rata Belanja", "up", c.atv, p.atv, atvSpark),
    money("Total Retur", "down", c.returnsValue, p.returnsValue, sp.returnsValue),
    money("Total Pembelian", "neutral", c.purchases, p.purchases, sp.purchases),
  ];
}

function buildTodayVsYesterday(k: TerminalKpis): { name: string; today: number; yest: number; yestSoFar: number; isCount?: boolean; invert?: boolean }[] {
  const t = k.today, y = k.yesterday, ys = k.yesterdaySoFar;
  return [
    { name: "Omzet", today: t.netRevenue, yest: y.netRevenue, yestSoFar: ys.netRevenue },
    { name: "Transaksi", today: t.transactions, yest: y.transactions, yestSoFar: ys.transactions, isCount: true },
    { name: "Pemasukan", today: t.grossRevenue, yest: y.grossRevenue, yestSoFar: ys.grossRevenue },
    { name: "Pengeluaran", today: t.purchases, yest: y.purchases, yestSoFar: ys.purchases, invert: true },
  ];
}

type Props = {
  kpis: TerminalKpis;
  chart: TerminalChartData;
  period: { from: string; to: string };
};

export default function AnalyticsTerminalPreview({ kpis, chart, period: initialPeriod }: Props) {
  const router = useRouter();
  // 3 grafik (Harian/Bulanan/Tahunan) dari data asli, semuanya mengikuti periode.
  const sections: Section[] = chart.series.map((s) => ({
    id: s.id,
    title: s.title,
    rangeNote: s.rangeNote,
    unit: "rp",
    defaultStyle: "spike",
    ranges: [],
    labels: s.labels,
    income: s.income,
    expense: s.expense,
  }));

  const [flipped, setFlipped] = useState(true);
  // Default Mode Tunggal (bukan Perbandingan) — owner ingin tampilan tunggal dulu.
  const [compare, setCompare] = useState(false);
  // Jam "sekarang" untuk keterangan "hari ini baru sampai jam ...". null saat SSR
  // (hindari hydration mismatch dari jam server vs client), terisi setelah mount.
  const [nowLabel, setNowLabel] = useState<string | null>(null);
  const [styles, setStyles] = useState<Record<string, Style>>({});
  // Periode global: dipakai server untuk mengambil data. Diatur lewat URL (?from&to).
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  // Awal minggu ini (Senin). getDay(): 0=Min..6=Sab → mundur ke Senin terdekat.
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  // Bulan lalu: tgl 1 s/d hari terakhir bulan lalu (hari 0 bulan ini).
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const period = initialPeriod;
  const setPeriod = (next: { from: string; to: string }) => {
    router.push(`/reports/preview?from=${next.from}&to=${next.to}`);
  };

  // Jam "sekarang" untuk keterangan perbandingan (diperbarui tiap menit).
  useEffect(() => {
    const set = () => { const d = new Date(); setNowLabel(`${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`); };
    set();
    const id = setInterval(set, 60000);
    return () => clearInterval(id);
  }, []);

  // angka KPI & "Hari ini vs Kemarin" dari data asli
  const tickers = buildTickers(kpis, chart.spark);
  const todayVsYesterday = buildTodayVsYesterday(kpis);
  // Periode terpilih mencakup hari ini? (string ISO yyyy-mm-dd bisa dibanding langsung)
  const includesToday = period.to >= iso(today);

  // Saat Mode Analitik aktif, gelapkan latar seluruh halaman (shell + root) supaya
  // terminal menyatu dengan background. Dipulihkan saat kembali ke Tampilan Normal.
  // Saat halaman ini dibuka, paksa dark mode. Saat navigasi keluar, pulihkan tema asli.
  useEffect(() => {
    const wasDark = document.documentElement.classList.contains("dark");
    document.documentElement.classList.add("dark");
    const main = document.querySelector<HTMLElement>("main");
    const targets = [main, document.body, document.documentElement].filter(Boolean) as HTMLElement[];
    targets.forEach((el) => el.style.setProperty("background-color", C.bg, "important"));
    return () => {
      document.documentElement.classList.toggle("dark", wasDark);
      targets.forEach((el) => el.style.removeProperty("background-color"));
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="page-title" style={flipped ? { color: C.text } : undefined}>SeaHorse Company</h1>
          <p className="mobile-section-copy" style={flipped ? { color: C.muted } : undefined}>by MeijrVerse°</p>
        </div>
        {flipped ? (
          <button type="button" onClick={() => router.push("/reports")} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-lg transition-all duration-300 active:scale-95" style={{ color: "#fff", background: C.panel2, boxShadow: "0 0 0 1px " + C.border }}>
            <Sparkles className="h-4 w-4" style={{ color: C.gold }} />
            Kembali ke Laporan
          </button>
        ) : (
          <button type="button" onClick={() => setFlipped(true)} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-bold shadow-lg transition-all duration-300 active:scale-95" style={{ color: "#fff", background: "linear-gradient(135deg,#16c784,#0ea5e9)", boxShadow: "0 10px 30px rgba(14,165,233,0.35)" }}>
            <Sparkles className="h-4 w-4" style={{ color: "#fff" }} />
            Mode Analitik
          </button>
        )}
      </div>

      <div className="relative">
        <div className={`grid gap-3 transition-all duration-500 sm:grid-cols-3 ${flipped ? "pointer-events-none absolute inset-0 -translate-y-2 opacity-0" : "opacity-100"}`}>
          {["Omzet Bersih", "Total Transaksi", "Total Retur"].map((t) => (
            <div key={t} className="surface-panel rounded-2xl p-5"><p className="text-xs font-bold text-slate-500 dark:text-slate-400">{t}</p><p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Rp —</p><p className="mt-2 text-xs text-slate-400">Tampilan laporan biasa</p></div>
          ))}
        </div>

        <div className={`transition-all duration-500 ${flipped ? "opacity-100" : "pointer-events-none absolute inset-0 translate-y-2 opacity-0"}`}>
          <div className="overflow-hidden rounded-3xl" style={{ background: "radial-gradient(120% 60% at 50% 0%, #101a2e 0%, " + C.bg + " 60%)", border: `1px solid ${C.border}`, color: C.text, boxShadow: "0 24px 60px rgba(0,0,0,0.5)" }}>
            <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-4" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-2 lg:gap-3">
                <Activity className="h-5 w-5 shrink-0 lg:h-6 lg:w-6" style={{ color: C.gold }} />
                <span className="text-base font-extrabold tracking-wide sm:text-lg lg:text-2xl xl:text-3xl">Terminal Analitik</span>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-fit">
                {/* toggle Perbandingan / Tunggal */}
                <button type="button" onClick={() => setCompare((v) => !v)} className="inline-flex h-9 w-fit items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors lg:h-11 lg:gap-2.5 lg:rounded-2xl lg:px-5 lg:text-sm" style={{ background: compare ? C.income + "22" : C.panel2, color: compare ? C.income : C.muted, border: `1px solid ${compare ? C.income + "55" : C.border}` }}>
                  <GitCompareArrows className="h-4 w-4 lg:h-5 lg:w-5" />
                  {compare ? "Mode: Perbandingan" : "Mode: Tunggal"}
                </button>
              </div>
            </div>

            {/* Periode global — satu rentang tanggal untuk SEMUA grafik di bawah */}
            <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-4" style={{ borderColor: C.border }}>
              <div className="flex items-center gap-2 lg:gap-3">
                <CalendarRange className="h-4 w-4 shrink-0 lg:h-5 lg:w-5" style={{ color: C.gold }} />
                <span className="text-xs font-bold lg:text-sm xl:text-base" style={{ color: C.muted }}>Periode laporan</span>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex items-center gap-1.5">
                <input type="date" value={period.from} max={period.to} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className="h-9 rounded-lg px-2 text-xs font-semibold outline-none lg:h-10 lg:text-sm lg:px-3" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}`, colorScheme: "dark" }} />
                <span style={{ color: C.muted }}>–</span>
                <input type="date" value={period.to} min={period.from} max={iso(today)} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className="h-9 rounded-lg px-2 text-xs font-semibold outline-none lg:h-10 lg:text-sm lg:px-3" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}`, colorScheme: "dark" }} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {([
                    { label: "Hari Ini", from: iso(today), to: iso(today) },
                    { label: "Minggu Ini", from: iso(weekStart), to: iso(today) },
                    { label: "Bulan Ini", from: iso(monthStart), to: iso(today) },
                    { label: "Bulan Lalu", from: iso(lastMonthStart), to: iso(lastMonthEnd) },
                    { label: "Tahun Ini", from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) },
                  ] as const).map((q) => {
                    const on = period.from === q.from && period.to === q.to;
                    return <button key={q.label} type="button" onClick={() => setPeriod({ from: q.from, to: q.to })} className="rounded-full px-3 py-1.5 text-xs font-bold transition-colors lg:px-4 lg:py-2 lg:text-sm" style={{ background: on ? C.gold + "22" : "transparent", color: on ? C.gold : C.muted, border: `1px solid ${on ? C.gold + "55" : C.border}` }}>{q.label}</button>;
                  })}
                </div>
              </div>
            </div>

            {/* KPI ticker (tetap) — kartu 3D */}
            <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:gap-4 lg:p-5 xl:grid-cols-4">
              {tickers.map((t) => {
                const col = changeColor(t), up = t.changePct >= 0;
                return (
                  <div key={t.name} className="rounded-xl p-3 lg:p-4 xl:p-5" style={{ border: card3d.border, boxShadow: card3d.boxShadow, background: `radial-gradient(130% 90% at 100% 0%, ${col}26, transparent 55%), linear-gradient(180deg, #16213a 0%, #0d1320 72%)` }}>
                    <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold leading-tight lg:text-sm" style={{ color: C.muted }}>{t.name}</span>{t.spark ? <Spark data={t.spark} color={col} /> : null}</div>
                    <div className="mt-1 flex items-end justify-between gap-2"><span className="text-lg font-extrabold tracking-tight lg:text-2xl xl:text-3xl">{t.value}</span>
                      <span className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold lg:text-sm" style={{ background: col + "22", color: col }}>{t.goodWhen === "neutral" ? <Minus className="h-3 w-3" /> : up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{up ? "+" : ""}{t.changePct}%</span>
                    </div>
                    {t.high && t.low ? (
                      <div className="mt-2 flex items-center justify-between text-xs lg:text-sm" style={{ color: C.muted }}><span>Tertinggi {t.high}</span><span>Terendah {t.low}</span></div>
                    ) : t.sub ? (
                      <div className="mt-2 text-xs lg:text-sm" style={{ color: C.muted }}>{t.sub}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {includesToday ? (
              <p className="px-3 pb-1 text-xs sm:px-4 lg:px-5" style={{ color: C.muted }}>Periode ini belum selesai — persentase dibandingkan periode sebelumnya yang sama panjang.</p>
            ) : null}

            {/* Hari ini vs Kemarin */}
            <div className="px-3 sm:px-4">
              <div className="rounded-2xl p-3 sm:p-4" style={card3d}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                  <p className="text-sm font-extrabold lg:text-base xl:text-lg">Hari Ini vs Kemarin</p>
                  {nowLabel ? <p className="text-xs lg:text-sm" style={{ color: C.muted }}>Dibandingkan kemarin sampai jam {nowLabel}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {todayVsYesterday.map((m) => {
                    // Perbandingan ADIL: hari ini (berjalan) vs kemarin s/d jam yang sama.
                    const diff = m.today - m.yestSoFar, pct = m.yestSoFar ? (diff / m.yestSoFar) * 100 : 0;
                    const good = m.invert ? diff <= 0 : diff >= 0, col = good ? C.up : C.down;
                    const fmt = (v: number) => (m.isCount ? String(v) : rpShort(v));
                    return (
                      <div key={m.name} className="rounded-xl p-2.5 lg:p-4" style={inset}>
                        <p className="truncate text-xs font-bold lg:text-sm xl:text-base" style={{ color: C.muted }}>{m.name}</p>
                        <div className="mt-1 flex items-end justify-between gap-1.5">
                          <span className="truncate text-base font-extrabold lg:text-xl xl:text-2xl">{fmt(m.today)}</span>
                          <span className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold lg:text-sm" style={{ background: col + "22", color: col }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
                        </div>
                        <p className="mt-1 text-xs leading-snug lg:text-sm" style={{ color: C.muted }}>Kemarin jam ini: {fmt(m.yestSoFar)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Satu grafik adaptif (satuan mengikuti periode) */}
            <div className="space-y-3 p-3 sm:space-y-4 sm:p-4 lg:space-y-5 lg:p-5 xl:p-6">
              {sections.map((s) => {
                const st = styles[s.id] ?? "spike";
                const labels = s.labels, income = s.income, expense = s.expense;
                const totInc = income.reduce((a, b) => a + b, 0), totExp = expense.reduce((a, b) => a + b, 0), selisih = totInc - totExp;
                const front = (
                  <div className="h-full rounded-2xl" style={card3d}>
                    <div className="flex flex-col gap-2.5 border-b p-3 sm:p-4 lg:p-5" style={{ borderColor: C.border }}>
                      <div className="flex items-center justify-between gap-2">
                        <div><p className="text-sm font-extrabold lg:text-base xl:text-lg">Chart {s.title}</p><p className="text-xs lg:text-sm" style={{ color: C.muted }}>{s.rangeNote}</p></div>
                        <select value={st} onChange={(e) => setStyles((p) => ({ ...p, [s.id]: e.target.value as Style }))} className="h-9 rounded-lg px-2 text-xs font-bold outline-none lg:h-10 lg:px-3 lg:text-sm" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}` }}>
                          {styleChoices.map((c) => <option key={c.v} value={c.v} style={{ background: C.panel }}>{c.label}</option>)}
                        </select>
                      </div>
                      {compare ? <div className="flex flex-wrap items-center gap-3 text-xs lg:text-sm" style={{ color: C.muted }}><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full lg:h-2.5 lg:w-2.5" style={{ background: C.income }} />Pemasukan</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full lg:h-2.5 lg:w-2.5" style={{ background: C.expense }} />Pengeluaran</span></div> : null}
                    </div>

                    {labels.length === 0 ? (
                      <div className="px-3 py-10 text-center text-sm" style={{ color: C.muted }}>Belum ada data pada periode ini.</div>
                    ) : (
                    <div className="px-2 pt-3 sm:px-3"><div className="rounded-xl px-1 py-2" style={inset}><Chart style={st} labels={labels} income={income} expense={expense} unit={s.unit} compare={compare} /></div></div>
                    )}

                    {compare ? (
                      <div className="grid grid-cols-3 gap-2 px-3 pt-3 sm:px-4 lg:gap-3 lg:px-5 lg:pt-4">
                        <div className="rounded-xl px-2 py-2 text-center lg:px-4 lg:py-3" style={inset}><p className="text-xs lg:text-sm xl:text-base" style={{ color: C.muted }}>Pemasukan</p><p className="mt-0.5 text-sm font-bold tabular-nums lg:text-base xl:text-lg" style={{ color: C.income }}>{rpShort(unitVal(totInc, s.unit))}</p></div>
                        <div className="rounded-xl px-2 py-2 text-center lg:px-4 lg:py-3" style={inset}><p className="text-xs lg:text-sm xl:text-base" style={{ color: C.muted }}>Pengeluaran</p><p className="mt-0.5 text-sm font-bold tabular-nums lg:text-base xl:text-lg" style={{ color: C.expense }}>{rpShort(unitVal(totExp, s.unit))}</p></div>
                        <div className="rounded-xl px-2 py-2 text-center lg:px-4 lg:py-3" style={inset}><p className="text-xs lg:text-sm xl:text-base" style={{ color: C.muted }}>Arus Kas</p><p className="mt-0.5 text-sm font-bold tabular-nums lg:text-base xl:text-lg" style={{ color: selisih >= 0 ? C.up : C.down }}>{rpShort(unitVal(selisih, s.unit))}</p></div>
                      </div>
                    ) : (
                      <div className="px-3 pt-3 sm:px-4 lg:px-5"><div className="rounded-xl px-3 py-2 text-center lg:py-3" style={inset}><p className="text-xs lg:text-sm" style={{ color: C.muted }}>Total {s.title}</p><p className="mt-0.5 text-base font-extrabold tabular-nums lg:text-xl" style={{ color: C.income }}>{rpShort(unitVal(totInc, s.unit))}</p></div></div>
                    )}

                    {compare ? (
                      <p className="px-3 pt-2 text-xs leading-relaxed sm:px-4 lg:px-5" style={{ color: C.muted }}>Pemasukan = uang dari penjualan · Pengeluaran = beli stok + biaya operasional · Arus Kas = Pemasukan − Pengeluaran (retur pelanggan belum dipotong)</p>
                    ) : null}

                    <div className="p-3 sm:p-4 lg:p-5">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="text-sm font-bold lg:text-base" style={{ color: C.muted }}>Rincian 6 {UNIT_WORD[s.id]} Terakhir</p>
                        <p className="text-xs lg:text-sm" style={{ color: C.muted }}>{compare ? "Arus Kas = Masuk − Keluar" : `Tren = dibanding ${UNIT_WORD[s.id].toLowerCase()} sebelumnya`}</p>
                      </div>
                      {(() => {
                        // prev dihitung dari deret PENUH (bukan yang sudah dipotong zoom),
                        // supaya baris pertama tetap punya pembanding yang benar.
                        const base = s.income.length - income.length;
                        const cols = compare ? "minmax(0,1.1fr) 1fr 1fr 1fr" : "minmax(0,1.4fr) 1fr 1fr";
                        const rows = labels
                          .map((lb, i) => ({ lb, inc: income[i], exp: expense[i], prev: base + i > 0 ? s.income[base + i - 1] : null }))
                          .slice(-6);
                        return (
                          <div className="overflow-hidden rounded-xl" style={inset}>
                            <div className="grid items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide lg:text-sm" style={{ color: C.muted, borderBottom: `1px solid ${C.border}`, gridTemplateColumns: cols }}>
                              <span>{UNIT_WORD[s.id]}</span>
                              <span className="text-right">Masuk</span>
                              {compare ? <span className="text-right">Keluar</span> : null}
                              <span className="text-right">{compare ? "Arus Kas" : "Tren"}</span>
                            </div>
                            {rows.map((r, idx) => {
                              const sel = r.inc - r.exp;
                              const dpct = r.prev != null && r.prev !== 0 ? ((r.inc - r.prev) / r.prev) * 100 : null;
                              return (
                                <div key={r.lb} className="grid items-center gap-2 px-3 py-2.5 text-xs lg:py-3 lg:text-sm" style={{ gridTemplateColumns: cols, borderTop: idx ? `1px solid ${C.border}66` : "none" }}>
                                  <span className="truncate font-bold">{r.lb}</span>
                                  <span className="text-right font-bold tabular-nums" style={{ color: C.income }}>{rpShort(unitVal(r.inc, s.unit))}</span>
                                  {compare ? <span className="text-right font-bold tabular-nums" style={{ color: C.expense }}>{rpShort(unitVal(r.exp, s.unit))}</span> : null}
                                  <span className="text-right font-bold tabular-nums" style={{ color: compare ? (sel >= 0 ? C.up : C.down) : dpct == null ? C.muted : dpct >= 0 ? C.up : C.down }}>
                                    {compare ? rpShort(unitVal(sel, s.unit)) : dpct == null ? "—" : `${dpct >= 0 ? "+" : ""}${dpct.toFixed(1)}%`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
                return <div key={s.id}>{front}</div>;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
