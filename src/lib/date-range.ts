/**
 * A day range as the library's filters carry it: two `yyyy-mm-dd` keys in the URL, read as whole
 * days by the server. Keys rather than instants, so a range picked on a phone in Mumbai and one
 * typed in a URL mean the same days.
 */
export interface DayRange {
  from?: string;
  to?: string;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** A local calendar day as its key — the date the person sees, not the UTC instant under it. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A key back to a local date at midnight; anything malformed is nothing. */
export function fromDayKey(key: string | undefined): Date | undefined {
  if (!key) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const dayYear = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "12 Sep – 27 Sep 2026", "From 12 Sep 2026", "Until 27 Sep 2026", or "Any time". */
export function formatDayRange(range: DayRange): string {
  const from = fromDayKey(range.from);
  const to = fromDayKey(range.to);
  if (from && to) {
    if (range.from === range.to) return dayYear.format(from);
    return `${from.getFullYear() === to.getFullYear() ? day.format(from) : dayYear.format(from)} – ${dayYear.format(to)}`;
  }
  if (from) return `From ${dayYear.format(from)}`;
  if (to) return `Until ${dayYear.format(to)}`;
  return "Any time";
}

export interface DayRangePreset {
  label: string;
  range: (today: Date) => DayRange;
}

const daysAgo = (today: Date, days: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() - days);
  return date;
};

/** The ranges people reach for; each is a pair of keys ending today or at the month's edge. */
export const DAY_RANGE_PRESETS: DayRangePreset[] = [
  { label: "Last 7 days", range: (today) => ({ from: toDayKey(daysAgo(today, 6)), to: toDayKey(today) }) },
  { label: "Last 30 days", range: (today) => ({ from: toDayKey(daysAgo(today, 29)), to: toDayKey(today) }) },
  {
    label: "This month",
    range: (today) => ({ from: toDayKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: toDayKey(today) }),
  },
  {
    label: "Last month",
    range: (today) => ({
      from: toDayKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: toDayKey(new Date(today.getFullYear(), today.getMonth(), 0)),
    }),
  },
];
