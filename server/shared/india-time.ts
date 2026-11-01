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

/** "4:12 pm". */
export function indiaTime(value: Date): string {
  return value.toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit", hour12: true, timeZone: ZONE });
}

/**
 * "Sat 2 Nov", for a calendar day — a `@db.Date` column, or a "YYYY-MM-DD" string. A day has no
 * time zone, and Prisma hands one back as UTC midnight, so it is read in UTC: reading it in India
 * would be right only by luck of the offset's sign.
 */
export function calendarDay(value: Date | string): string {
  const date = typeof value === "string" ? fromIsoDay(value) : value;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(LOCALE, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

/** "2026-11-02" → that day at UTC midnight, the way a `@db.Date` column stores it. */
export function fromIsoDay(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** A stored calendar day as "2026-11-02". */
export function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Today in India as "2026-11-02": the day a pickup date is compared against. */
export function indiaToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: ZONE });
}

/** "30 Oct 2026". */
export function indiaDate(value: Date): string {
  return value.toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: ZONE });
}
