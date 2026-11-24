// The picker's filters as the query string the library route parses (picker-filters trd D4, D5):
// blanks out, never `retired` (Q3), and a tag only where the tab's items can carry one (R2, Q6).
import { describe, expect, it } from "vitest";
import { NO_PICKER_FILTERS, activePickerFilterCount, hasPickerFilters, pickerQuery } from "@/lib/media/picker-query";

describe("pickerQuery", () => {
  it("sends only the kind when nothing is filtered", () => {
    expect(pickerQuery("IMAGE", NO_PICKER_FILTERS)).toBe("kind=IMAGE");
  });

  it("carries tag, usage, source and the two day keys on Photos (spec A1)", () => {
    const query = pickerQuery("IMAGE", { tag: "PRODUCT", usage: "unused", source: "UPLOAD", from: "2026-11-01", to: "2026-11-24" });
    expect(query).toBe("kind=IMAGE&tag=PRODUCT&usage=unused&source=UPLOAD&from=2026-11-01&to=2026-11-24");
  });

  it("drops a chosen tag on a tab whose items take no tags (spec A2)", () => {
    const filters = { ...NO_PICKER_FILTERS, tag: "REFERENCE" as const, usage: "used" as const };
    expect(pickerQuery("VIDEO", filters)).toBe("kind=VIDEO&usage=used");
    expect(pickerQuery("VIDEO_EMBED", filters)).toBe("kind=VIDEO_EMBED&usage=used");
  });

  it("drops a source that cannot occur on the tab: a YouTube item is only a link, a photo never one (Q7)", () => {
    expect(pickerQuery("VIDEO_EMBED", { ...NO_PICKER_FILTERS, source: "UPLOAD" })).toBe("kind=VIDEO_EMBED");
    expect(pickerQuery("IMAGE", { ...NO_PICKER_FILTERS, source: "EMBED" })).toBe("kind=IMAGE");
    expect(activePickerFilterCount("VIDEO_EMBED", { ...NO_PICKER_FILTERS, source: "DERIVED" })).toBe(0);
    expect(pickerQuery("VIDEO", { ...NO_PICKER_FILTERS, source: "DERIVED" })).toBe("kind=VIDEO&source=DERIVED");
  });

  it("never sends retired, whatever arrives", () => {
    const smuggled = { ...NO_PICKER_FILTERS, retired: "1" } as typeof NO_PICKER_FILTERS;
    expect(pickerQuery("IMAGE", smuggled)).not.toContain("retired");
  });
});

describe("activePickerFilterCount", () => {
  it("counts what applies to the tab in view; a range is one filter (trd D5)", () => {
    const filters = { tag: "PRODUCT" as const, usage: "unused" as const, source: "", from: "2026-11-24", to: "2026-11-24" };
    expect(activePickerFilterCount("IMAGE", filters)).toBe(3);
    expect(activePickerFilterCount("VIDEO", filters)).toBe(2);
    expect(activePickerFilterCount("IMAGE", NO_PICKER_FILTERS)).toBe(0);
  });

  it("a tag hidden on Videos does not make the tab filtered (Q6)", () => {
    expect(hasPickerFilters("VIDEO", { ...NO_PICKER_FILTERS, tag: "PRODUCT" })).toBe(false);
    expect(hasPickerFilters("IMAGE", { ...NO_PICKER_FILTERS, tag: "PRODUCT" })).toBe(true);
  });
});
