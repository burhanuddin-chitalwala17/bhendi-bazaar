// Listings that look like one item, where the marketplace does not group them (family-merge D6, Q5).
import { describe, expect, it } from "vitest";

import { skuStem, suggestGroups } from "@server/channels/listing-match";

const row = (id: string, sku: string, title: string | null) => ({ id, sku, title });

describe("same-item suggestions (spec A4, Q5)", () => {
  it("joins listings whose SKUs differ only at the end, or whose titles are close", () => {
    const groups = suggestGroups([
      row("1", "HJB-CHF-PCH", "Chiffon Hijab Peach"),
      row("2", "HJB-CHF-SGE", "Chiffon Hijab Sage"),
      row("3", "MAT-VLV-GRN", "Velvet Prayer Mat Green"),
      row("4", "PM-77", "Velvet Prayer Mat Maroon"),
      row("5", "BAKH-01", "Brass Bakhoor Burner"),
    ]);
    expect(groups.map((g) => g.map((r) => r.id).sort())).toEqual([["1", "2"], ["3", "4"]]);
  });

  it("never offers a listing on its own, and reads a one-part SKU as having no stem", () => {
    expect(suggestGroups([row("1", "BAKH01", "Brass Bakhoor Burner")])).toEqual([]);
    expect(skuStem("BAKH01")).toBeNull();
    // A brand and a number are not one item: two-part SKUs never chain listings together.
    expect(skuStem("HJB-001")).toBeNull();
    expect(suggestGroups([row("1", "HJB-001", "Brass Bakhoor Burner"), row("2", "HJB-002", "Velvet Prayer Mat Green")])).toEqual([]);
    expect(skuStem("HJB-CHF-PCH")).toBe("hjb-chf");
  });

  it("keeps a group within what one family page takes (Q19)", () => {
    const many = Array.from({ length: 31 }, (_, i) => row(String(i), `TEE-RED-${i}`, null));
    expect(suggestGroups(many)).toEqual([]);
  });
});
