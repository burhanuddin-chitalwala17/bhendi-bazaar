/**
 * Listings → Fix → Edit product unwinds one step at a time (navigation-flows R4, A1): each screen
 * carries the one that opened it as `from`, and a `from` that is not our own path is never followed (R8).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { safeReturnPath, withFrom } from "@/lib/safe-callback-url";
import { ListingFixes } from "@/components/channel/listing-fixes";
import { LISTING_FIX, type ListingScreenDTO } from "@server/channels/platform-listing.types";
import { FIX } from "@/components/channel/platform-listing-copy";

const listings = "/org/o1/channels/amazon/listings?tab=linked&q=bag&fix=1";
const listingScreen = withFrom("/org/o1/products/p1/listings/amazon", listings);

describe("a screen's start", () => {
  it("round-trips a filtered Listings address through two hops", () => {
    const editHref = withFrom("/org/o1/products/p1/edit?section=details#brand", listingScreen);
    const editFrom = new URL(editHref, "https://x.test").searchParams.get("from");
    expect(editHref.endsWith("#brand")).toBe(true);
    expect(editFrom).toBe(listingScreen);
    expect(new URL(editFrom!, "https://x.test").searchParams.get("from")).toBe(listings);
  });

  it.each(["https://elsewhere.example", "//elsewhere.example", "/\\elsewhere.example", "javascript:alert(1)", ""])(
    "falls back to the natural parent for %j (A5)",
    (from) => expect(safeReturnPath(from, "/org/o1/products/p1")).toBe("/org/o1/products/p1"),
  );

  it("the listing screen's Fix buttons carry the screen as their start", () => {
    const screenDto = {
      channel: "amazon",
      label: "Amazon",
      productId: "p1",
      productName: "Cloth bag",
      locked: { mrpPaise: null, barcode: null, brand: null, stock: 1 },
      draft: null,
      fixes: [{ kind: LISTING_FIX.MRP, names: [] }],
    } as unknown as ListingScreenDTO;
    render(<ListingFixes orgId="o1" screen={screenDto} from={listingScreen} />);
    const href = screen.getByRole("link", { name: FIX.mrpAction }).getAttribute("href")!;
    expect(new URL(href, "https://x.test").searchParams.get("from")).toBe(listingScreen);
  });
});
