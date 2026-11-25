/** social-selling/whatsapp-sending unit 1: the pure rules behind the port and the settings (D1, D3, D4, D6). */
import { describe, expect, it } from "vitest";

import { DomainError } from "@server/shared/domain-error";
import { MESSAGE_CATEGORY, SEND_PURPOSE } from "@server/campaigns/campaigns.types";
import {
  assertAdvanced,
  assertHours,
  assertLimit,
  DEFAULT_ADVANCED,
  DEFAULT_HOURS,
  istMonth,
  istWindowStarts,
  withinHowOften,
} from "@server/campaigns/messaging-rules";
import { categoryOf, estimatePaise, WHATSAPP_RATES } from "@server/campaigns/rates";

describe("IST windows", () => {
  it("counts a month in India time: 31 Oct 19:00 UTC is already November", () => {
    expect(istMonth(new Date("2026-10-31T18:29:59Z"))).toBe("2026-10");
    expect(istMonth(new Date("2026-10-31T18:30:00Z"))).toBe("2026-11");
  });

  it("starts the day at IST midnight and the week on Monday", () => {
    // Wed 25 Nov 2026, 02:00 IST.
    const { dayStart, weekStart } = istWindowStarts(new Date("2026-11-24T20:30:00Z"));
    expect(dayStart.toISOString()).toBe("2026-11-24T18:30:00.000Z");
    expect(weekStart.toISOString()).toBe("2026-11-22T18:30:00.000Z");
  });

  it("puts a Monday's own start at that Monday", () => {
    const { dayStart, weekStart } = istWindowStarts(new Date("2026-11-23T05:00:00Z"));
    expect(weekStart.toISOString()).toBe(dayStart.toISOString());
  });
});

describe("how often (parent Q40)", () => {
  it("allows one more only under both the day and the week count", () => {
    const rule = { howOftenDay: 1, howOftenWeek: 4 };
    expect(withinHowOften({ today: 0, week: 3 }, rule)).toBe(true);
    expect(withinHowOften({ today: 1, week: 1 }, rule)).toBe(false);
    expect(withinHowOften({ today: 0, week: 4 }, rule)).toBe(false);
  });

  it("defaults to once a day and four times a week", () => {
    expect(DEFAULT_ADVANCED).toMatchObject({ howOftenDay: 1, howOftenWeek: 4 });
  });
});

describe("rates (D3, Q10)", () => {
  it("prices every category in whole paise, with a source and a checked date", () => {
    for (const paise of Object.values(WHATSAPP_RATES.paisePerMessage)) expect(Number.isInteger(paise)).toBe(true);
    expect(WHATSAPP_RATES.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(WHATSAPP_RATES.source).not.toBe("");
  });

  it("estimates rate × count, and prices a utility send as utility", () => {
    expect(estimatePaise(MESSAGE_CATEGORY.MARKETING, 3)).toBe(WHATSAPP_RATES.paisePerMessage.MARKETING * 3);
    expect(categoryOf(SEND_PURPOSE.UTILITY)).toBe(MESSAGE_CATEGORY.UTILITY);
    expect(categoryOf(SEND_PURPOSE.MARKETING)).toBe(MESSAGE_CATEGORY.MARKETING);
  });
});

describe("settings refusals (ux.md: Refused)", () => {
  it("refuses a limit under ₹100 and a fractional one; accepts No limit", () => {
    expect(() => assertLimit(9_999)).toThrow(DomainError);
    expect(() => assertLimit(10_000.5)).toThrow(DomainError);
    expect(() => assertLimit(10_000)).not.toThrow();
    expect(() => assertLimit(null)).not.toThrow();
  });

  it("refuses closing before opening, and a time that is not HH:MM", () => {
    expect(() => assertHours({ ...DEFAULT_HOURS, MON: { open: "21:00", close: "10:00" } })).toThrow(DomainError);
    expect(() => assertHours({ ...DEFAULT_HOURS, TUE: { open: "10:00", close: "10:00" } })).toThrow(DomainError);
    expect(() => assertHours({ ...DEFAULT_HOURS, WED: { open: "9am", close: "21:00" } })).toThrow(DomainError);
    expect(() => assertHours(DEFAULT_HOURS)).not.toThrow();
  });

  it("refuses more a day than a week, and values out of range", () => {
    expect(() => assertAdvanced({ ...DEFAULT_ADVANCED, howOftenDay: 5, howOftenWeek: 4 })).toThrow(DomainError);
    expect(() => assertAdvanced({ ...DEFAULT_ADVANCED, howOftenWeek: 0 })).toThrow(DomainError);
    expect(() => assertAdvanced({ ...DEFAULT_ADVANCED, botPauseHours: 1.5 })).toThrow(DomainError);
    expect(() => assertAdvanced(DEFAULT_ADVANCED)).not.toThrow();
  });
});
