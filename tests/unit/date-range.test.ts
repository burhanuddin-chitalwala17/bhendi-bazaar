// The library's date filter is one range, carried as two day keys (media-library spec R6): a key
// is the day a person sees, the label reads as people say dates, and the presets end where a
// person expects.
import { describe, expect, it } from "vitest";
import { DAY_RANGE_PRESETS, formatDayRange, fromDayKey, toDayKey } from "@/lib/date-range";

describe("day keys", () => {
  it("round-trip a local day and refuse anything malformed", () => {
    const date = new Date(2026, 8, 27, 23, 30);
    expect(toDayKey(date)).toBe("2026-09-27");
    expect(fromDayKey("2026-09-27")?.getDate()).toBe(27);
    expect(fromDayKey("27/09/2026")).toBeUndefined();
    expect(fromDayKey("")).toBeUndefined();
  });
});

describe("formatDayRange", () => {
  it("reads as people say dates, and says so when one end or both are open", () => {
    expect(formatDayRange({ from: "2026-09-12", to: "2026-09-27" })).toBe("12 Sept – 27 Sept 2026");
    expect(formatDayRange({ from: "2025-12-30", to: "2026-01-02" })).toBe("30 Dec 2025 – 2 Jan 2026");
    expect(formatDayRange({ from: "2026-09-27", to: "2026-09-27" })).toBe("27 Sept 2026");
    expect(formatDayRange({ from: "2026-09-12" })).toBe("From 12 Sept 2026");
    expect(formatDayRange({ to: "2026-09-27" })).toBe("Until 27 Sept 2026");
    expect(formatDayRange({})).toBe("Any time");
  });
});

describe("presets", () => {
  const today = new Date(2026, 8, 27);
  const by = Object.fromEntries(DAY_RANGE_PRESETS.map((preset) => [preset.label, preset.range(today)]));

  it("end today, or at the month's edge, and count the days people mean", () => {
    expect(by["Last 7 days"]).toEqual({ from: "2026-09-21", to: "2026-09-27" });
    expect(by["Last 30 days"]).toEqual({ from: "2026-08-29", to: "2026-09-27" });
    expect(by["This month"]).toEqual({ from: "2026-09-01", to: "2026-09-27" });
    expect(by["Last month"]).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });
});
