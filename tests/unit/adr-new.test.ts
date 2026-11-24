import { describe, it, expect } from "vitest";
import { nextNumber, render, slugify } from "../../scripts/adr-new.mjs";

describe("adr:new", () => {
  it("numbers after the highest ADR, ignoring the index and gaps", () => {
    expect(nextNumber(["README.md", "0001-a.md", "0072-b.md", "0070-c.md"])).toBe("0073");
    expect(nextNumber(["README.md"])).toBe("0001");
  });

  it("makes a filename from the title", () => {
    expect(slugify("A shop's storefront: heading face, closed list")).toBe("a-shops-storefront-heading-face-closed-list");
  });

  it("writes a header docs-index can read, starting as Proposed", () => {
    const text = render("0079", "Title", "2026-11-24");
    expect(text).toMatch(/^# ADR-0079: Title\n\n- \*\*Date:\*\* 2026-11-24\n- \*\*Status:\*\* Proposed\n/);
  });
});
