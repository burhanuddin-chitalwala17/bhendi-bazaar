import { DomainError } from "@server/shared/domain-error";
import {
  CAMPAIGNS_COPY,
  MIN_LIMIT_PAISE,
  WEEKDAYS,
  type MessagingAdvanced,
  type ShopHours,
  type TouchCounts,
} from "./campaigns.types";

/** India has no daylight saving, so IST is a fixed offset. */
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11" for the IST calendar month `now` falls in: spend is counted per it (Q11). */
export function istMonth(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

/** The instants the IST day and the IST week (Monday first) began, for the how-often count. */
export function istWindowStarts(now: Date): { dayStart: Date; weekStart: Date } {
  const shifted = now.getTime() + IST_OFFSET_MS;
  const dayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  const daysSinceMonday = (new Date(dayStartShifted).getUTCDay() + 6) % 7;
  return {
    dayStart: new Date(dayStartShifted - IST_OFFSET_MS),
    weekStart: new Date(dayStartShifted - daysSinceMonday * DAY_MS - IST_OFFSET_MS),
  };
}

/** The how-often rule (parent Q40): one more touch is allowed only under both counts. */
export function withinHowOften(counts: TouchCounts, rule: Pick<MessagingAdvanced, "howOftenDay" | "howOftenWeek">): boolean {
  return counts.today < rule.howOftenDay && counts.week < rule.howOftenWeek;
}

export const DEFAULT_HOURS: ShopHours = {
  MON: { open: "10:00", close: "21:00" },
  TUE: { open: "10:00", close: "21:00" },
  WED: { open: "10:00", close: "21:00" },
  THU: { open: "10:00", close: "21:00" },
  FRI: { open: "10:00", close: "21:00" },
  SAT: { open: "10:00", close: "21:00" },
  SUN: null,
};

/** Advanced's defaults (parent Q40, Q112; enquiry-autoreplies Q2, Q5; demand-alerts Q8). */
export const DEFAULT_ADVANCED: MessagingAdvanced = {
  howOftenDay: 1,
  howOftenWeek: 4,
  greetingDelaySeconds: 30,
  botPauseHours: 12,
  alertsPerProductPerDay: 1,
};

/** A limit is an amount of at least ₹100, or null for "No limit" (ux.md: Refused). */
export function assertLimit(limitPaise: number | null): void {
  if (limitPaise === null) return;
  if (!Number.isSafeInteger(limitPaise) || limitPaise < MIN_LIMIT_PAISE) {
    throw new DomainError(CAMPAIGNS_COPY.limitTooLow, { field: "limitPaise" });
  }
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Every day present; an open day closes after it opens ("HH:MM" compares as text). */
export function assertHours(hours: ShopHours): void {
  for (const day of WEEKDAYS) {
    const slot = hours[day];
    if (slot === null) continue;
    if (!slot || !TIME.test(slot.open) || !TIME.test(slot.close)) {
      throw new DomainError(CAMPAIGNS_COPY.badTime, { field: `hours.${day}` });
    }
    if (slot.close <= slot.open) throw new DomainError(CAMPAIGNS_COPY.closesBeforeOpening, { field: `hours.${day}` });
  }
}

const BOUNDS: Record<keyof MessagingAdvanced, [number, number]> = {
  howOftenDay: [1, 7],
  howOftenWeek: [1, 7],
  greetingDelaySeconds: [0, 600],
  botPauseHours: [1, 72],
  alertsPerProductPerDay: [1, 5],
};

export function assertAdvanced(advanced: MessagingAdvanced): void {
  for (const key of Object.keys(BOUNDS) as (keyof MessagingAdvanced)[]) {
    const [min, max] = BOUNDS[key];
    const value = advanced[key];
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new DomainError(CAMPAIGNS_COPY.advancedRange, { field: key });
    }
  }
  if (advanced.howOftenDay > advanced.howOftenWeek) {
    throw new DomainError(CAMPAIGNS_COPY.howOftenRange, { field: "howOftenDay" });
  }
}
