import { Fragment } from "react";

export type RadarSeries = {
  /** Nilai 0-100 per sumbu, urutannya sama dengan `axes`. */
  values: number[];
  /** Kelas Tailwind untuk garis (stroke-*) & isian (fill-*) poligon. */
  className: string;
  /** Kelas untuk titik (default mengikuti `className`). */
  dotClassName?: string;
  label?: string;
};

type PerformanceRadarProps = {
  axes: readonly string[];
  series: RadarSeries[];
  /** Jumlah cincin grid. */
  rings?: number;
  className?: string;
};

// Kanvas lebih lebar dari tinggi supaya label sumbu kiri/kanan tidak terpotong.
const WIDTH = 360;
const HEIGHT = 300;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const RADIUS = 90;
const LABEL_RADIUS = RADIUS + 22;

function pointAt(axisIndex: number, axisCount: number, ratio: number) {
  // Mulai dari atas (-90°), searah jarum jam.
  const angle = (Math.PI * 2 * axisIndex) / axisCount - Math.PI / 2;
  const r = RADIUS * ratio;

  return {
    x: CENTER_X + r * Math.cos(angle),
    y: CENTER_Y + r * Math.sin(angle),
  };
}

function polygonPoints(values: number[], axisCount: number) {
  return values
    .map((value, index) => {
      const { x, y } = pointAt(index, axisCount, Math.min(value, 100) / 100);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/**
 * Radar / spider chart digambar tangan (sistem ini tidak memakai library chart).
 * Warna garis & isian mengikuti palet lewat kelas Tailwind yang dioper pemanggil.
 */
export default function PerformanceRadar({
  axes,
  series,
  rings = 4,
  className,
}: PerformanceRadarProps) {
  const axisCount = axes.length;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Grafik radar performa"
      className={className}
    >
      {/* Cincin grid */}
      {Array.from({ length: rings }).map((_, ringIndex) => {
        const ratio = (ringIndex + 1) / rings;
        const points = axes
          .map((_, axisIndex) => {
            const { x, y } = pointAt(axisIndex, axisCount, ratio);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");

        return (
          <polygon
            key={`ring-${ringIndex}`}
            points={points}
            className="fill-none stroke-slate-200 dark:stroke-white/10"
            strokeWidth={1}
          />
        );
      })}

      {/* Jari-jari + label sumbu */}
      {axes.map((axis, axisIndex) => {
        const outer = pointAt(axisIndex, axisCount, 1);
        const label = pointAt(axisIndex, axisCount, LABEL_RADIUS / RADIUS);
        const anchor =
          Math.abs(label.x - CENTER_X) < 4
            ? "middle"
            : label.x > CENTER_X
              ? "start"
              : "end";

        return (
          <Fragment key={`axis-${axis}`}>
            <line
              x1={CENTER_X}
              y1={CENTER_Y}
              x2={outer.x}
              y2={outer.y}
              className="stroke-slate-200 dark:stroke-white/10"
              strokeWidth={1}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-slate-500 text-[11px] font-bold dark:fill-slate-400"
            >
              {axis}
            </text>
          </Fragment>
        );
      })}

      {/* Poligon data */}
      {series.map((item, seriesIndex) => (
        <Fragment key={`series-${item.label ?? seriesIndex}`}>
          <polygon
            points={polygonPoints(item.values, axisCount)}
            className={item.className}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {item.values.map((value, axisIndex) => {
            const { x, y } = pointAt(
              axisIndex,
              axisCount,
              Math.min(value, 100) / 100,
            );

            return (
              <circle
                key={`dot-${seriesIndex}-${axisIndex}`}
                cx={x}
                cy={y}
                r={3}
                className={item.dotClassName ?? item.className}
              />
            );
          })}
        </Fragment>
      ))}
    </svg>
  );
}
