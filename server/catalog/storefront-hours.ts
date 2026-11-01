/**
 * A shop's opening hours (storefront-themes D13, Q45): one opening and closing time and the days
 * it stays shut, which is how a counter in a bazaar keeps hours. Parsed on read; a malformed
 * value reads as none, so the visit line closes up rather than printing nonsense.
 */

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Sunday first, as `Date.getDay()` counts. */
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface OpeningHours {
  open: string;
  close: string;
  closedDays: number[];
}

export function readOpeningHours(value: unknown): OpeningHours | null {
  if (!value || typeof value !== "object") return null;
  const { open, close, closedDays } = value as Record<string, unknown>;
  if (typeof open !== "string" || typeof close !== "string") return null;
  if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) return null;
  const days = Array.isArray(closedDays)
    ? closedDays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : [];
  return { open, close, closedDays: [...new Set(days)].sort() };
}

/** "10:30" → "10:30 am", "21:00" → "9 pm". */
export function clockLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/** The weekday in India, where every shop on the platform keeps its hours. */
function indiaWeekday(now: Date): number {
  const name = now.toLocaleDateString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" });
  return WEEKDAYS.indexOf(name as (typeof WEEKDAYS)[number]);
}

/** "10:30 am – 9 pm" for today, or null when the shop is shut today or gave no hours. */
export function hoursToday(hours: OpeningHours | null, now: Date = new Date()): string | null {
  if (!hours || hours.closedDays.includes(indiaWeekday(now))) return null;
  return `${clockLabel(hours.open)} – ${clockLabel(hours.close)}`;
}
