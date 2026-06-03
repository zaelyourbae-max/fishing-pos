"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TerminalChartData, TerminalKpis, TerminalLivePoint, TerminalSpark } from "@/lib/analytics-terminal";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  GitCompareArrows,
  Minus,
  Radio,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   PREVIEW MOCK — "Mode Analitik" ala Bloomberg / Binance.
   Variasi chart banyak, bisa mode TUNGGAL atau PERBANDINGAN, ada custom rentang,
   kartu 3D. Semua angka DATA CONTOH (dummy). Tidak terhubung ke data asli.
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
  { v: "volume", label: "Garis + volume" },
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

/* ── MODE LIVE: grafik per-transaksi (papan saham intraday) ───────────────── */
function fmtClock(t: number, withDate: boolean) {
  const d = new Date(t);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return withDate ? `${d.getDate()}/${d.getMonth() + 1} ${hh}.${mm}` : `${hh}.${mm}`;
}

function LiveCard({ points, active }: { points: TerminalLivePoint[]; active: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<{ a: number; b: number }>({ a: 0, b: 1 });
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const pinch = useRef<{ dist: number; frac: number } | null>(null);
  const W = 760, H = 260, pad = { t: 20, r: 18, b: 32, l: 66 };
  const iw = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const n = points.length;

  const tMin = n ? points[0].t : 0;
  const tMax = n ? points[n - 1].t : 1;
  const tSpan = tMax - tMin || 1;
  const maxA = (n ? Math.max(...points.map((p) => p.amount)) : 1) * 1.16 || 1;
  // jendela minimum ~ 8 menit (atau full kalau rentang memang kecil)
  const MINW = Math.min(1, Math.max(1 / 4000, (8 * 60 * 1000) / tSpan));

  // Reset zoom hanya saat AWAL periode berganti (tMin), bukan saat transaksi baru
  // masuk (yang hanya menambah di ujung kanan / mengubah tMax).
  useEffect(() => { setView({ a: 0, b: 1 }); }, [tMin]);

  const vw = view.b - view.a;
  const vTmin = tMin + view.a * tSpan;
  const vTspan = vw * tSpan || 1;
  const x = (t: number) => (n === 1 ? pad.l + iw / 2 : pad.l + ((t - vTmin) / vTspan) * iw);
  const y = (a: number) => pad.t + (1 - a / maxA) * plotH;

  // Path "step": datar di level transaksi sebelumnya, lalu loncat pas ada transaksi baru.
  let linePath = "";
  let areaPath = "";
  if (n) {
    const seg: string[] = [`M ${x(points[0].t)} ${y(points[0].amount)}`];
    for (let i = 1; i < n; i++) {
      seg.push(`L ${x(points[i].t)} ${y(points[i - 1].amount)}`); // tahan datar
      seg.push(`L ${x(points[i].t)} ${y(points[i].amount)}`);     // loncat
    }
    linePath = seg.join(" ");
    const baseY = pad.t + plotH;
    areaPath = `${seg.join(" ")} L ${x(points[n - 1].t)} ${baseY} L ${x(points[0].t)} ${baseY} Z`;
  }

  // frac 0..1 di area plot berdasar koordinat layar
  function plotFrac(clientX: number) {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return 0.5;
    const vx = ((clientX - r.left) / r.width) * W;
    return Math.min(1, Math.max(0, (vx - pad.l) / iw));
  }
  function zoomAround(frac: number, factor: number) {
    if (n <= 1) return;
    setView((v) => {
      const w = v.b - v.a;
      const nw = Math.min(1, Math.max(MINW, w * factor));
      const center = v.a + frac * w;
      let na = center - (center - v.a) * (nw / w);
      let nb = na + nw;
      if (na < 0) { na = 0; nb = nw; }
      if (nb > 1) { nb = 1; na = 1 - nw; }
      return { a: na, b: nb };
    });
  }
  function panByPx(dxPx: number) {
    const r = wrap.current?.getBoundingClientRect();
    if (!r) return;
    const plotPxW = r.width * (iw / W);
    setView((v) => {
      const w = v.b - v.a;
      const fd = (dxPx / plotPxW) * w;
      let na = v.a - fd, nb = v.b - fd;
      if (na < 0) { na = 0; nb = w; }
      if (nb > 1) { nb = 1; na = 1 - w; }
      return { a: na, b: nb };
    });
  }
  function nearestHover(clientX: number) {
    const r = wrap.current?.getBoundingClientRect();
    if (!r || !n) return;
    const vx = ((clientX - r.left) / r.width) * W;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < n; i++) { const d = Math.abs(x(points[i].t) - vx); if (d < bestD) { bestD = d; best = i; } }
    setHover(best);
  }

  // wheel zoom (perlu non-passive agar bisa preventDefault scroll halaman)
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // Zoom HANYA saat menahan Ctrl/⌘ (atau pinch trackpad yang mengirim ctrlKey).
      // Tanpa itu, biarkan halaman scroll seperti biasa — supaya chart tidak
      // "menculik" scroll halaman & tidak nge-zoom sendiri tanpa sengaja.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAround(plotFrac(e.clientX), e.deltaY > 0 ? 1.18 : 1 / 1.18);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, MINW, tSpan, tMin]);

  function onMouseDown(e: React.MouseEvent) { drag.current = { x: e.clientX, moved: false }; }
  function onMouseMove(e: React.MouseEvent) {
    if (drag.current) {
      const dx = e.clientX - drag.current.x;
      drag.current = { x: e.clientX, moved: true };
      setHover(null);
      panByPx(dx);
    } else {
      nearestHover(e.clientX);
    }
  }
  function endDrag() { drag.current = null; }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length >= 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch.current = { dist: Math.abs(a.clientX - b.clientX) || 1, frac: plotFrac((a.clientX + b.clientX) / 2) };
    } else {
      drag.current = { x: e.touches[0].clientX, moved: false };
      nearestHover(e.touches[0].clientX);
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length >= 2 && pinch.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const dist = Math.abs(a.clientX - b.clientX) || 1;
      zoomAround(pinch.current.frac, pinch.current.dist / dist);
      pinch.current = { dist, frac: pinch.current.frac };
    } else if (drag.current) {
      const dx = e.touches[0].clientX - drag.current.x;
      drag.current = { x: e.touches[0].clientX, moved: true };
      panByPx(dx);
    }
  }
  function endTouch() { drag.current = null; pinch.current = null; }

  const lastIdx = n - 1;
  const zoomed = view.a > 0.0001 || view.b < 0.9999;
  const xLabelFracs = [0, 0.5, 1];
  const withDateVisible = vTspan > 24 * 3600 * 1000;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2.5 border-b p-3 sm:p-4 lg:p-5" style={{ borderColor: C.border }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {active ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: C.up }} /> : null}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: active ? C.up : C.muted }} />
            </span>
            <div>
              <p className="text-sm font-extrabold lg:text-base xl:text-lg">Mode Live</p>
              <p className="text-[11px] lg:text-xs" style={{ color: C.muted }}>Tombol / cubit / Ctrl+scroll untuk zoom · geser untuk jalan</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {n > 1 ? (
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: C.panel2, border: `1px solid ${C.border}` }}>
                <button type="button" aria-label="Perkecil" onClick={() => zoomAround(0.5, 1.4)} className="flex h-7 w-7 items-center justify-center rounded-md lg:h-8 lg:w-8" style={{ color: C.muted }}><ZoomOut className="h-4 w-4" /></button>
                <button type="button" aria-label="Perbesar" onClick={() => zoomAround(0.5, 1 / 1.4)} className="flex h-7 w-7 items-center justify-center rounded-md lg:h-8 lg:w-8" style={{ color: C.muted }}><ZoomIn className="h-4 w-4" /></button>
                <button type="button" aria-label="Reset zoom" onClick={() => setView({ a: 0, b: 1 })} className="flex h-7 w-7 items-center justify-center rounded-md lg:h-8 lg:w-8" style={{ color: zoomed ? C.gold : C.muted }}><RotateCcw className="h-4 w-4" /></button>
              </div>
            ) : null}
            <span className="rounded-lg px-2 py-1 text-[10px] font-bold lg:text-xs" style={{ background: C.up + "22", color: C.up, border: `1px solid ${C.up}55` }}>{n} transaksi</span>
          </div>
        </div>
      </div>

      {n === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 py-12 text-center text-[12px]" style={{ color: C.muted }}>Belum ada transaksi pada periode ini.</div>
      ) : (
        <div className="flex-1 p-2 sm:p-3 lg:p-4">
          <div className="relative h-full min-h-[230px] rounded-xl lg:min-h-[360px] xl:min-h-[440px]" style={inset}>
            <div
              ref={wrap}
              className="relative h-full w-full select-none"
              style={{ touchAction: "pan-y", cursor: drag.current ? "grabbing" : "grab" }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={endDrag}
              onMouseLeave={() => { endDrag(); setHover(null); }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={endTouch}
            >
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                <defs>
                  <linearGradient id="liveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.up} stopOpacity="0.30" />
                    <stop offset="60%" stopColor={C.up} stopOpacity="0.06" />
                    <stop offset="100%" stopColor={C.up} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="liveStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0ea5e9" />
                    <stop offset="100%" stopColor={C.up} />
                  </linearGradient>
                  <clipPath id="livePlot"><rect x={pad.l} y={pad.t - 6} width={iw} height={plotH + 6} /></clipPath>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => <line key={i} x1={pad.l} y1={pad.t + p * plotH} x2={W - pad.r} y2={pad.t + p * plotH} stroke={C.border} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 5" />)}

                <g clipPath="url(#livePlot)">
                  <path d={areaPath} fill="url(#liveFill)" />
                  <path d={linePath} fill="none" stroke={C.up} strokeWidth={8} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
                  <path d={linePath} fill="none" stroke="url(#liveStroke)" strokeWidth={2.4} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />

                  {/* titik live berdenyut di transaksi terakhir */}
                  <circle cx={x(points[lastIdx].t)} cy={y(points[lastIdx].amount)} r={3.5} fill={C.up} />
                  {active ? (
                    <circle cx={x(points[lastIdx].t)} cy={y(points[lastIdx].amount)} r={4} fill="none" stroke={C.up} strokeWidth={1.5} vectorEffect="non-scaling-stroke">
                      <animate attributeName="r" values="4;16" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                  ) : null}

                  {hover !== null ? <>
                    <line x1={x(points[hover].t)} y1={pad.t} x2={x(points[hover].t)} y2={pad.t + plotH} stroke={C.muted} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                    <circle cx={x(points[hover].t)} cy={y(points[hover].amount)} r={3.5} fill={C.up} stroke={C.bg} strokeWidth={1.5} />
                  </> : null}
                </g>
              </svg>

              {[1, 0.5, 0].map((p, i) => (
                <span key={`y${i}`} className="pointer-events-none absolute z-[1] -translate-y-1/2 rounded px-1 text-[10px] font-semibold tabular-nums" style={{ left: 2, top: `${(y(maxA * p) / H) * 100}%`, background: C.panel, color: C.muted }}>{rpShort(maxA * p)}</span>
              ))}
              {xLabelFracs.map((fr) => (
                <span key={`x${fr}`} className="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px]" style={{ left: `${((pad.l + fr * iw) / W) * 100}%`, color: C.muted }}>{fmtClock(vTmin + fr * vTspan, withDateVisible)}</span>
              ))}

              {hover !== null ? (
                <div className="pointer-events-none absolute top-2 z-10 rounded-lg border px-3 py-2 text-[11px] shadow-xl" style={{ left: `${Math.min(82, Math.max(14, (x(points[hover].t) / W) * 100))}%`, transform: "translateX(-50%)", background: C.panel2, borderColor: C.border, color: C.text }}>
                  <p className="font-bold">{fmtClock(points[hover].t, true)}</p>
                  <p style={{ color: C.up }}>{rpShort(points[hover].amount)}</p>
                  <p style={{ color: C.muted }}>{points[hover].invoice}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

  function setFromX(clientX: number) {
    const r = wrap.current?.getBoundingClientRect(); if (!r) return;
    const frac = (((clientX - r.left) / r.width) * W - gx0) / iw;
    setHover(Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1)))));
  }

  const area = (arr: number[], fillId: string, strokeId: string, glow: string) => (
    <>
      <path d={`${smooth(XY(arr))} L ${x(n - 1)} ${plotBottom} L ${gx0} ${plotBottom} Z`} fill={`url(#${fillId})`} />
      <path d={smooth(XY(arr))} fill="none" stroke={glow} strokeWidth={8} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      <path d={smooth(XY(arr))} fill="none" stroke={`url(#${strokeId})`} strokeWidth={2.4} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </>
  );

  return (
    <div ref={wrap} className="relative h-[210px] w-full select-none sm:h-[250px]" style={{ touchAction: "none" }} onMouseMove={(e) => setFromX(e.clientX)} onMouseLeave={() => setHover(null)} onTouchStart={(e) => setFromX(e.touches[0].clientX)} onTouchMove={(e) => setFromX(e.touches[0].clientX)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.income} stopOpacity="0.28" /><stop offset="55%" stopColor={C.income} stopOpacity="0.07" /><stop offset="100%" stopColor={C.income} stopOpacity="0" /></linearGradient>
          <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.expense} stopOpacity="0.22" /><stop offset="55%" stopColor={C.expense} stopOpacity="0.05" /><stop offset="100%" stopColor={C.expense} stopOpacity="0" /></linearGradient>
          <linearGradient id="si" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9bdcff" /><stop offset="100%" stopColor="#2a9fe0" /></linearGradient>
          <linearGradient id="se" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffb3bd" /><stop offset="100%" stopColor="#e8455f" /></linearGradient>
          <linearGradient id="bi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6cccf7" stopOpacity="0.95" /><stop offset="100%" stopColor="#1f7fb8" stopOpacity="0.55" /></linearGradient>
          <linearGradient id="be" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb8392" stopOpacity="0.95" /><stop offset="100%" stopColor="#c52941" stopOpacity="0.55" /></linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => <line key={i} x1={pad.l} y1={pad.t + p * plotH} x2={W - pad.r} y2={pad.t + p * plotH} stroke={C.border} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 5" />)}
        {/* label sumbu dipindah ke HTML overlay (di bawah) supaya tidak distorsi di mobile */}

        {(style === "bars" || style === "barline") ? labels.map((_, i) => (
          <g key={i}>
            <rect x={both && style === "bars" ? cx(i) - bw - 1 : cx(i) - bw / 2} y={y(income[i])} width={bw} height={plotBottom - y(income[i])} rx={3} fill="url(#bi)" />
            {both && style === "bars" ? <rect x={cx(i) + 1} y={y(expense[i])} width={bw} height={plotBottom - y(expense[i])} rx={3} fill="url(#be)" /> : null}
          </g>
        )) : null}
        {style === "barline" ? <><path d={smooth(XY(both ? expense : income))} fill="none" stroke={both ? C.expense : C.gold} strokeWidth={8} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" strokeLinecap="round" /><path d={smooth(XY(both ? expense : income))} fill="none" stroke={both ? "url(#se)" : C.gold} strokeWidth={2.5} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></> : null}

        {style === "area" ? <>{area(income, "gi", "si", C.income)}{both ? area(expense, "ge", "se", C.expense) : null}</> : null}
        {style === "line" ? <>
          <path d={smooth(XY(income))} fill="none" stroke={C.income} strokeWidth={8} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d={smooth(XY(income))} fill="none" stroke="url(#si)" strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          {both ? <><path d={smooth(XY(expense))} fill="none" stroke={C.expense} strokeWidth={8} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" strokeLinecap="round" /><path d={smooth(XY(expense))} fill="none" stroke="url(#se)" strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></> : null}
        </> : null}
        {style === "spike" ? <>
          <polyline points={XY(income).map((p) => p.join(",")).join(" ")} fill="none" stroke={C.income} strokeWidth={8} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
          <polyline points={XY(income).map((p) => p.join(",")).join(" ")} fill="none" stroke="url(#si)" strokeWidth={2.4} vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
          {both ? <polyline points={XY(expense).map((p) => p.join(",")).join(" ")} fill="none" stroke="url(#se)" strokeWidth={2.4} vectorEffect="non-scaling-stroke" strokeLinejoin="miter" /> : null}
        </> : null}

        {usesVol ? <>
          {(both ? expense : income).map((v, i) => <rect key={i} x={x(i) - bw / 2} y={volY(v)} width={bw} height={pad.t + ih - volY(v)} rx={2} fill={both ? "url(#be)" : C.vol} opacity={both ? 0.6 : 0.65} />)}
          <path d={smooth(XY(income))} fill="none" stroke={C.income} strokeWidth={8} strokeOpacity={0.14} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <path d={smooth(XY(income))} fill="none" stroke="url(#si)" strokeWidth={2.6} vectorEffect="non-scaling-stroke" strokeLinecap="round" />
          <line x1={pad.l} y1={volTop} x2={W - pad.r} y2={volTop} stroke={C.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </> : null}

        {hover !== null ? <>
          <line x1={cx(hover)} y1={pad.t} x2={cx(hover)} y2={pad.t + ih} stroke={C.muted} strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          <circle cx={cx(hover)} cy={y(income[hover])} r={3.5} fill={C.income} stroke={C.bg} strokeWidth={1.5} />
          {both ? <circle cx={cx(hover)} cy={y(expense[hover])} r={3.5} fill={C.expense} stroke={C.bg} strokeWidth={1.5} /> : null}
        </> : null}
      </svg>

      {[1, 0.5, 0].map((p, i) => (
        <span key={`y${i}`} className="pointer-events-none absolute z-[1] -translate-y-1/2 rounded px-1 text-[10px] font-semibold tabular-nums" style={{ left: 2, top: `${(y(max * p) / H) * 100}%`, background: C.panel, color: C.muted }}>{rpShort(unitVal(max * p, unit))}</span>
      ))}
      {labels.map((lb, i) => (i % labelStep === 0 || i === n - 1) ? (
        <span key={`x${i}`} className="pointer-events-none absolute bottom-0 -translate-x-1/2 text-[10px]" style={{ left: `${(cx(i) / W) * 100}%`, color: C.muted }}>{lb}</span>
      ) : null)}

      {hover !== null ? (
        <div className="pointer-events-none absolute top-2 z-10 rounded-lg border px-3 py-2 text-[11px] shadow-xl" style={{ left: `${Math.min(88, Math.max(12, (cx(hover) / W) * 100))}%`, transform: "translateX(-50%)", background: C.panel2, borderColor: C.border, color: C.text }}>
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
    money("ATV", "up", c.atv, p.atv, atvSpark),
    money("Total Retur", "down", c.returnsValue, p.returnsValue, sp.returnsValue),
    money("Total Pembelian", "neutral", c.purchases, p.purchases, sp.purchases),
  ];
}

function buildTodayVsYesterday(k: TerminalKpis): { name: string; today: number; yest: number; isCount?: boolean; invert?: boolean }[] {
  const t = k.today, y = k.yesterday;
  return [
    { name: "Omzet", today: t.netRevenue, yest: y.netRevenue },
    { name: "Transaksi", today: t.transactions, yest: y.transactions, isCount: true },
    { name: "Pemasukan", today: t.grossRevenue, yest: y.grossRevenue },
    { name: "Pengeluaran", today: t.purchases, yest: y.purchases, invert: true },
  ];
}

type Props = {
  kpis: TerminalKpis;
  chart: TerminalChartData;
  live: TerminalLivePoint[];
  period: { from: string; to: string };
};

export default function AnalyticsTerminalPreview({ kpis, chart, live, period: initialPeriod }: Props) {
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
  const [compare, setCompare] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [livePoints, setLivePoints] = useState(live);
  const [styles, setStyles] = useState<Record<string, Style>>({});
  // Periode global: dipakai server untuk mengambil data. Diatur lewat URL (?from&to).
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const period = initialPeriod;
  const setPeriod = (next: { from: string; to: string }) => {
    router.push(`/reports/preview?from=${next.from}&to=${next.to}`);
  };

  // Sinkron ulang titik Live saat periode berganti (server kirim prop baru).
  useEffect(() => { setLivePoints(live); }, [live]);

  // Polling saat Mode Live aktif: transaksi baru muncul sendiri tiap ~9 detik
  // tanpa reload halaman. Berhenti saat Mode Live dimatikan atau tab disembunyikan.
  useEffect(() => {
    if (!liveMode) return;
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/api/reports/terminal-live?from=${period.from}&to=${period.to}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data.points)) setLivePoints(data.points as TerminalLivePoint[]);
      } catch {
        /* abaikan error jaringan sesaat; coba lagi di tick berikutnya */
      }
    };
    const id = setInterval(tick, 9000);
    tick();
    return () => { alive = false; clearInterval(id); };
  }, [liveMode, period.from, period.to]);

  // angka KPI & "Hari ini vs Kemarin" dari data asli
  const tickers = buildTickers(kpis, chart.spark);
  const todayVsYesterday = buildTodayVsYesterday(kpis);

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
              <div className="flex w-fit items-center gap-2">
                {/* tombol Mode Live — flip kartu Chart Harian jadi grafik per-transaksi */}
                <button type="button" onClick={() => setLiveMode((v) => !v)} className="inline-flex h-9 w-fit items-center gap-2 rounded-xl px-3 text-xs font-bold transition-colors lg:h-11 lg:gap-2.5 lg:rounded-2xl lg:px-5 lg:text-sm" style={{ background: liveMode ? C.up + "22" : C.panel2, color: liveMode ? C.up : C.muted, border: `1px solid ${liveMode ? C.up + "55" : C.border}` }}>
                  <Radio className="h-4 w-4 lg:h-5 lg:w-5" />
                  Mode Live
                </button>
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
              <div className="flex flex-wrap items-center gap-1.5">
                <input type="date" value={period.from} max={period.to} onChange={(e) => setPeriod({ ...period, from: e.target.value })} className="h-8 rounded-lg px-2 text-[11px] font-semibold outline-none lg:h-9 lg:text-xs lg:px-3" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}`, colorScheme: "dark" }} />
                <span style={{ color: C.muted }}>–</span>
                <input type="date" value={period.to} min={period.from} max={iso(today)} onChange={(e) => setPeriod({ ...period, to: e.target.value })} className="h-8 rounded-lg px-2 text-[11px] font-semibold outline-none lg:h-9 lg:text-xs lg:px-3" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}`, colorScheme: "dark" }} />
                <span className="ml-1 flex flex-wrap items-center gap-1.5">
                  {([
                    { label: "Hari Ini", from: iso(today), to: iso(today) },
                    { label: "Bulan Ini", from: iso(monthStart), to: iso(today) },
                    { label: "Tahun Ini", from: iso(new Date(today.getFullYear(), 0, 1)), to: iso(today) },
                  ] as const).map((q) => {
                    const on = period.from === q.from && period.to === q.to;
                    return <button key={q.label} type="button" onClick={() => setPeriod({ from: q.from, to: q.to })} className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors lg:px-3 lg:py-1.5 lg:text-xs" style={{ background: on ? C.gold + "22" : "transparent", color: on ? C.gold : C.muted, border: `1px solid ${on ? C.gold + "55" : C.border}` }}>{q.label}</button>;
                  })}
                </span>
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
                      <div className="mt-2 flex items-center justify-between text-[10px] lg:text-xs" style={{ color: C.muted }}><span>Tertinggi {t.high}</span><span>Terendah {t.low}</span></div>
                    ) : t.sub ? (
                      <div className="mt-2 text-[10px] lg:text-xs" style={{ color: C.muted }}>{t.sub}</div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Hari ini vs Kemarin */}
            <div className="px-3 sm:px-4">
              <div className="rounded-2xl p-3 sm:p-4" style={card3d}>
                <p className="mb-2 text-sm font-extrabold lg:text-base xl:text-lg">Hari Ini vs Kemarin</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {todayVsYesterday.map((m) => {
                    const diff = m.today - m.yest, pct = m.yest ? (diff / m.yest) * 100 : 0;
                    const good = m.invert ? diff <= 0 : diff >= 0, col = good ? C.up : C.down;
                    const fmt = (v: number) => (m.isCount ? String(v) : rpShort(v));
                    return (
                      <div key={m.name} className="rounded-xl p-2.5 lg:p-4" style={inset}>
                        <p className="text-[11px] font-bold lg:text-xs xl:text-sm" style={{ color: C.muted }}>{m.name}</p>
                        <p className="mt-1 text-base font-extrabold lg:text-xl xl:text-2xl">{fmt(m.today)}</p>
                        <div className="mt-1 flex items-center justify-between text-[10px] lg:text-xs" style={{ color: C.muted }}><span>Kmrn {fmt(m.yest)}</span><span className="font-bold" style={{ color: col }}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span></div>
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
                        <div><p className="text-sm font-extrabold lg:text-base xl:text-lg">Chart {s.title}</p><p className="text-[11px] lg:text-xs" style={{ color: C.muted }}>{s.rangeNote}</p></div>
                        <select value={st} onChange={(e) => setStyles((p) => ({ ...p, [s.id]: e.target.value as Style }))} className="h-8 rounded-lg px-2 text-[11px] font-bold outline-none lg:h-10 lg:px-3 lg:text-sm" style={{ background: C.panel2, color: C.text, border: `1px solid ${C.border}` }}>
                          {styleChoices.map((c) => <option key={c.v} value={c.v} style={{ background: C.panel }}>{c.label}</option>)}
                        </select>
                      </div>
                      {compare ? <div className="flex flex-wrap items-center gap-3 text-[11px] lg:text-sm" style={{ color: C.muted }}><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full lg:h-2.5 lg:w-2.5" style={{ background: C.income }} />Pemasukan</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full lg:h-2.5 lg:w-2.5" style={{ background: C.expense }} />Pengeluaran</span></div> : null}
                    </div>

                    {labels.length === 0 ? (
                      <div className="px-3 py-10 text-center text-[12px]" style={{ color: C.muted }}>Belum ada data pada periode ini.</div>
                    ) : (
                    <div className="px-2 pt-3 sm:px-3"><div className="rounded-xl px-1 py-2" style={inset}><Chart style={st} labels={labels} income={income} expense={expense} unit={s.unit} compare={compare} /></div></div>
                    )}

                    {compare ? (
                      <div className="grid grid-cols-3 gap-2 px-3 pt-3 sm:px-4 lg:gap-3 lg:px-5 lg:pt-4">
                        <div className="rounded-xl px-2 py-2 text-center lg:px-4 lg:py-3" style={inset}><p className="text-[10px] lg:text-xs xl:text-sm" style={{ color: C.muted }}>Pemasukan</p><p className="mt-0.5 text-sm font-bold tabular-nums lg:text-base xl:text-lg" style={{ color: C.income }}>{rpShort(unitVal(totInc, s.unit))}</p></div>
                        <div className="rounded-xl px-2 py-2 text-center lg:px-4 lg:py-3" style={inset}><p className="text-[10px] lg:text-xs xl:text-sm" style={{ color: C.muted }}>Pengeluaran</p><p className="mt-0.5 text-sm font-bold tabular-nums lg:text-base xl:text-lg" style={{ color: C.expense }}>{rpShort(unitVal(totExp, s.unit))}</p></div>
                        <div className="rounded-xl px-2 py-2 text-center lg:px-4 lg:py-3" style={inset}><p className="text-[10px] lg:text-xs xl:text-sm" style={{ color: C.muted }}>Arus Kas</p><p className="mt-0.5 text-sm font-bold tabular-nums lg:text-base xl:text-lg" style={{ color: selisih >= 0 ? C.up : C.down }}>{rpShort(unitVal(selisih, s.unit))}</p></div>
                      </div>
                    ) : (
                      <div className="px-3 pt-3 sm:px-4 lg:px-5"><div className="rounded-xl px-3 py-2 text-center lg:py-3" style={inset}><p className="text-[10px] lg:text-xs" style={{ color: C.muted }}>Total {s.title}</p><p className="mt-0.5 text-base font-extrabold tabular-nums lg:text-xl" style={{ color: C.income }}>{rpShort(unitVal(totInc, s.unit))}</p></div></div>
                    )}

                    <div className="p-3 sm:p-4 lg:p-5">
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="text-[11px] font-bold lg:text-sm" style={{ color: C.muted }}>Rincian per {UNIT_WORD[s.id]} (terbaru)</p>
                        <p className="text-[10px] lg:text-xs" style={{ color: C.muted }}>{compare ? "Arus Kas = Masuk − Keluar" : `Tren = vs ${UNIT_WORD[s.id].toLowerCase()} sebelumnya`}</p>
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
                            <div className="grid items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wide lg:text-xs" style={{ color: C.muted, borderBottom: `1px solid ${C.border}`, gridTemplateColumns: cols }}>
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
                // Hanya kartu "harian" yang bisa di-flip ke Mode Live.
                if (s.id === "harian") {
                  return (
                    <div key={s.id} className="[perspective:1800px]">
                      <div className="grid transition-transform duration-700 ease-out [transform-style:preserve-3d]" style={{ transform: liveMode ? "rotateY(180deg)" : "rotateY(0deg)" }}>
                        <div className="[grid-area:1/1] [backface-visibility:hidden]">{front}</div>
                        <div className="[grid-area:1/1] [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden rounded-2xl" style={card3d}>
                          <LiveCard points={livePoints} active={liveMode} />
                        </div>
                      </div>
                    </div>
                  );
                }
                return <div key={s.id}>{front}</div>;
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
