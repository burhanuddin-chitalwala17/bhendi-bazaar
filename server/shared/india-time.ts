/**
 * Dates as an Indian reader means them. The server runs in UTC, so a move at 23:30 UTC is already
 * tomorrow in India; every date a person reads goes through here (order-fulfilment D5).
 */
const ZONE = "Asia/Kolkata";
const LOCALE = "en-IN";

/** "3 Nov". */
export function indiaDay(value: Date): string {
  return value.toLocaleDateString(LOCALE, { day: "numeric", month: "short", timeZone: ZONE });
}

/** "3 Nov, 4:12 pm". */
export function indiaMoment(value: Date): string {
  return value.toLocaleString(LOCALE, {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: ZONE,
  });
}
