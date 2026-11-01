/**
 * Computing a marketplace listing from its product (channel-listings D3, D5, D8) and where it stands
 * (marketplace-publish Q4). Pure; every marketplace alike.
 */
import { describe, expect, it } from "vitest";

import { computeListing, listingStatus, masterValues, seedOverrides, snapshot, toWholeRupees, waitingFields } from "@server/channels/listing-plan";
import { LISTING_FIELD, LISTING_FIELDS } from "@server/channels/platform-listing.types";
import { listingSaveSchema } from "@/lib/validation/schemas/platform-listing.schema";

const master = masterValues({
  name: "Black Nida Abaya",
  price: 129_900,
  description: "An everyday abaya.",
  keyFeatures: ["Soft Nida"],
  media: [{ id: "m1" }, { id: "m2" }],
});

describe("a listing computed from its product", () => {
  it("inherits every field it does not override", () => {
    expect(computeListing(master, { title: "Short title" })).toEqual({ ...master, title: "Short title" });
  });

  it("drops a photo the product no longer has, and falls back when none is left (D8)", () => {
    expect(computeListing(master, { photos: ["m2", "gone"] }).photos).toEqual(["m2"]);
    expect(computeListing(master, { photos: ["gone"] }).photos).toEqual(["m1", "m2"]);
  });

  it("waits on a field only where the marketplace takes it and it differs from what was sent (R8, R10)", () => {
    const sent = snapshot(master, LISTING_FIELDS);
    const changed = computeListing({ ...master, description: "New words." }, {});
    expect(waitingFields(changed, sent, LISTING_FIELDS)).toEqual([LISTING_FIELD.DESCRIPTION]);
    expect(waitingFields(changed, sent, [LISTING_FIELD.PRICE, LISTING_FIELD.LISTED])).toEqual([]);
    expect(waitingFields(master, null, [LISTING_FIELD.PRICE])).toEqual([LISTING_FIELD.PRICE]);
  });
});

describe("a listing starts with what is live (Q2)", () => {
  it("keeps the marketplace's value where it differs, and nothing where it agrees or is unknown", () => {
    const seeded = seedOverrides(master, { title: "Premium Nida abaya", price: 129_900, description: "" });
    expect(seeded).toEqual({ title: "Premium Nida abaya" });
    expect(waitingFields(computeListing(master, seeded), snapshot(computeListing(master, seeded), LISTING_FIELDS), LISTING_FIELDS)).toEqual([]);
  });
});

describe("where a listing stands (publish Q4)", () => {
  const base = { onMarketplace: true, publishState: "idle", waiting: 0, issues: 0, listed: true, publishedAt: null, checkedAt: null, nextCheckAt: null };
  it("says draft, waiting, live, paused, and a refused change on a live listing apart", () => {
    expect(listingStatus({ ...base, onMarketplace: false }).status).toBe("draft");
    expect(listingStatus({ ...base, waiting: 2 }).status).toBe("waiting");
    expect(listingStatus(base).status).toBe("live");
    expect(listingStatus({ ...base, listed: false }).status).toBe("paused");
    expect(listingStatus({ ...base, publishState: "attention" }).status).toBe("live_refused");
    expect(listingStatus({ ...base, onMarketplace: false, publishState: "attention" }).status).toBe("attention");
  });
});

describe("prices and the body", () => {
  it("rounds down to the rupee for a marketplace that takes whole rupees (Q13)", () => {
    expect(toWholeRupees(129_950)).toBe(129_900);
    expect(toWholeRupees(129_900)).toBe(129_900);
  });

  it("refuses a strict field in a listing save rather than ignoring it (parent Q28)", () => {
    expect(listingSaveSchema.safeParse({ seenVersion: 0, overrides: { mrp: 2499 } }).success).toBe(false);
    expect(listingSaveSchema.safeParse({ seenVersion: 0, overrides: { title: "Ok", price: 1349 } }).success).toBe(true);
  });
});
