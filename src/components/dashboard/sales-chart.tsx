import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SalesDay } from "@server/analytics/sales.types";

/** The drawing's own coordinate space; the SVG scales to its box, so these are not pixels on screen. */
const WIDTH = 600;
const HEIGHT = 160;
const PAD = 8;

/**
 * Points for a line over `values`, oldest first, in the chart's coordinate space. The scale is
 * shared with `peak`, so this period and the one before are read on one axis; a peak of zero
 * (no sales at all) draws a flat line on the baseline rather than dividing by it.
 */
export function linePoints(values: readonly number[], peak: number): { x: number; y: number }[] {
  const scale = peak > 0 ? peak : 1;
  const step = values.length > 1 ? (WIDTH - PAD * 2) / (values.length - 1) : 0;
  return values.map((value, i) => ({
    x: values.length > 1 ? PAD + i * step : WIDTH / 2,
    y: HEIGHT - PAD - (Math.max(value, 0) / scale) * (HEIGHT - PAD * 2),
  }));
}

const path = (points: readonly { x: number; y: number }[]) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

/** "2026-11-04" is an India day; read at India midnight so the label never slips a day. */
const indiaDay = (day: string) => new Date(`${day}T00:00:00+05:30`);

/** About six labels whatever the period: every day of a week, every fifth of a month. */
function labelIndices(n: number): number[] {
  if (n <= 7) return Array.from({ length: n }, (_, i) => i);
  const every = Math.ceil(n / 6);
  return Array.from({ length: n }, (_, i) => i).filter((i) => (n - 1 - i) % every === 0);
}

/**
 * Sales by day, this period solid and the one before dashed (design-system Q13: drawn by hand, no
 * chart package). A server component: it ships no JavaScript. The picture is summarised for
 * assistive technology in one sentence, and the figures it shows are also printed beside it.
 */
export function SalesChart({
  series,
  previousSeries,
  currentLabel,
  previousLabel,
}: {
  series: readonly SalesDay[];
  previousSeries: readonly SalesDay[];
  currentLabel: string;
  previousLabel: string;
}) {
  if (series.length < 2) return null;

  const current = series.map((d) => d.paise);
  const previous = previousSeries.map((d) => d.paise);
  const peak = Math.max(0, ...current, ...previous);
  const now = linePoints(current, peak);
  const before = linePoints(previous, peak);
  const best = series.reduce((top, d) => (d.paise > top.paise ? d : top), series[0]);
  const weekday = series.length <= 7;
  const dayLabel = (day: string) =>
    formatDate(indiaDay(day), weekday ? { weekday: "short" } : { day: "numeric", month: "short" });

  const summary =
    peak === 0
      ? `No sales on any day of this period or the one before.`
      : `Sales by day. ${currentLabel}: ${formatCurrency(current.reduce((a, b) => a + b, 0))}, highest ${formatCurrency(best.paise)} on ${formatDate(indiaDay(best.day), { weekday: "long", day: "numeric", month: "long" })}. ${previousLabel}: ${formatCurrency(previous.reduce((a, b) => a + b, 0))}.`;

  return (
    <figure className="space-y-2">
      <figcaption className="flex items-center gap-4 text-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded-full bg-primary" />
          {currentLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />
          {previousLabel}
        </span>
      </figcaption>
      <svg
        role="img"
        aria-label={summary}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-40 w-full overflow-visible"
      >
        <line x1={PAD} x2={WIDTH - PAD} y1={HEIGHT - PAD} y2={HEIGHT - PAD} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {before.length > 1 && (
          <path d={path(before)} fill="none" className="stroke-muted-foreground" strokeWidth={1.5} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        )}
        <path d={path(now)} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div aria-hidden className="relative h-4 text-caption text-muted-foreground">
        {labelIndices(series.length).map((i) => (
          <span
            key={series[i].day}
            className={cn(
              "absolute whitespace-nowrap tabular-nums",
              i === 0 ? "translate-x-0" : i === series.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
            )}
            style={{ left: `${(now[i].x / WIDTH) * 100}%` }}
          >
            {dayLabel(series[i].day)}
          </span>
        ))}
      </div>
    </figure>
  );
}
