/**
 * The one module that knows money is stored as integer paise (Invariant 3,
 * ADR-0004). Amounts enter the system in rupees exactly once (rupeesToPaise, at the
 * server boundary), leave as a string exactly once (formatCurrency), and everything
 * between is integer arithmetic. A `* 100` or `/ 100` anywhere else is a bug.
 */

// Conversions live server-side (dependency direction is inward); re-exported here so
// client code has one import for all things money.
export { rupeesToPaise, paiseToRupees } from "@server/shared/money";

/** 1250 → 12.5. Rates are stored as integer basis points; this is the one way back to a percent. */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

/** 120050 → "₹1,200.50"; whole-rupee amounts drop the decimals: 120000 → "₹1,200". */
export function formatCurrency(paise: number, currency: "INR" = "INR") {
  const wholeRupees = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: wholeRupees ? 0 : 2,
    maximumFractionDigits: wholeRupees ? 0 : 2,
  }).format(paise / 100);
}

/**
 * `pending_payment` → `Pending Payment`. For rendering a declared status in a picker, so the
 * option list can be derived from the set rather than retyped beside it — eleven literals in the
 * admin order filter were how a filter came to offer statuses the domain no longer used.
 */
export function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** 65_000 → "1:05": a video's playing time, on a tile badge and beside the player. */
export function formatDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Every date and count is formatted in one locale and one zone. Left to the runtime, the server
 * (UTC, en-US) and the browser (IST, en-IN) print different text and React's hydration fails:
 * `10/8/2026` against `08/10/2026`, or a different day near midnight.
 */
const LOCALE = "en-IN";
const TIME_ZONE = "Asia/Kolkata";

/** A plain day, as this store writes one: "8 Oct 2026". */
export function formatDay(value: string | Date): string {
  return new Date(value).toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

/** Any other date shape, still in the store's locale and zone. */
export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString(LOCALE, { ...options, timeZone: TIME_ZONE });
}

/** A day in a table column: "08/10/2026". */
export function formatShortDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE });
}

/** A moment: "8/10/2026, 1:47:00 am". */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(LOCALE, { timeZone: TIME_ZONE });
}

/** 100000 → "1,00,000". */
export function formatCount(value: number): string {
  return value.toLocaleString(LOCALE);
}
