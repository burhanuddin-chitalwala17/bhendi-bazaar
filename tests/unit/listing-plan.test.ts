/**
 * Computing a marketplace listing from its product (channel-listings D3, D5, D8) and where it stands
 * (marketplace-publish Q4). Pure; every marketplace alike.
 */
import { describe, expect, it } from "vitest";

import { computeListing, fixesOf, listingStatus, masterValues, seedOverrides, snapshot, toWholeRupees, waitingFields } from "@server/channels/listing-plan";
import { LISTING_FIELD, LISTING_FIELDS } from "@server/channels/platform-listing.types";
import { listingSaveSchema } from "@/lib/validation/schemas/platform-listing.schema";

const master = masterValues({
  name: "Black Nida Abaya",
  price: 129_900,
  description: "An everyday abaya.",
  keyFeatures: ["Soft Nida"],
  media: [{ id: "m1", ref: "https://cdn/a.webp" }, { id: "m2", ref: "https://cdn/b.webp" }],
});

describe("a listing computed from its product", () => {
  it("inherits every field it does not override", () => {
    expect(computeListing(master, { title: "Short title" })).toEqual({ ...master, title: "Short title" });
  });

  it("drops a photo the product no longer has, and falls back when none is left (D8)", () => {
    expect(computeListing(master, { photos: ["https://cdn/b.webp", "gone"] }).photos).toEqual(["https://cdn/b.webp"]);
    expect(computeListing(master, { photos: ["gone"] }).photos).toEqual(["https://cdn/a.webp", "https://cdn/b.webp"]);
  });

  it("waits on a field only where the marketplace takes it and it differs from what was sent (R8, R10)", () => {
    const sent = snapshot(master, LISTING_FIELDS);
    const changed = computeListing({ ...master, description: "New words." }, {});
    expect(waitingFields(changed, sent, LISTING_FIELDS)).toEqual([LISTING_FIELD.DESCRIPTION]);
    expect(waitingFields(changed, sent, [LISTING_FIELD.PRICE, LISTING_FIELD.LISTED])).toEqual([]);
    expect(waitingFields(master, null, [LISTING_FIELD.PRICE])).toEqual([LISTING_FIELD.PRICE]);
  });
});

describe("photos kept by address (a product save renews media ids)", () => {
  it("reads old stored ids as addresses, and an id no longer held in what was sent as the product's photos", async () => {
    const { parseOverrides, parseSent } = await import("@server/channels/listing-plan");
    const media = [{ id: "m1", ref: "https://cdn/a.webp" }, { id: "m2", ref: "https://cdn/b.webp" }];
    expect(parseOverrides({ photos: ["m2", "m1"] }, media).photos).toEqual(["https://cdn/b.webp", "https://cdn/a.webp"]);
    expect(parseSent({ photos: ["gone-1"] }, media)?.photos).toEqual(["https://cdn/a.webp", "https://cdn/b.webp"]);
    expect(parseOverrides({ photos: ["gone-1", "m1"] }, media).photos).toEqual(["https://cdn/a.webp"]);
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

describe("how to fix what a marketplace refused (marketplace-publish Q24)", () => {
  const issue = (attribute: string | null, message: string, extra: object = {}) => ({ code: "90220", message, severity: "error" as const, field: null, attribute, need: null, ...extra });
  const facts = (attribute: string) =>
    attribute === "outer_material" ? { label: "Material", answered: false } : attribute === "color" ? { label: "Colour", answered: true } : null;

  it("sends each complaint to where it is fixed, and keeps only the unplaceable in the marketplace's words", () => {
    const vague = issue(null, "Catalog conflict");
    const { fixes, otherIssues } = fixesOf(
      [
        issue("brand", "'Brand Name' is required but missing.", { need: "brand" }),
        issue("purchasable_offer", "Attribute 'purchasable_offer' does not have the expected value(s).", { field: "price", need: "mrp" }),
        issue("outer_material", "'Outer Material' is required but missing."),
        issue("strap_type", "'Strap Type' is required but missing."),
        // Answered on the product but still refused: its value has no word there, which the admin maps.
        issue("color", "'Colour' is not a valid value."),
        issue("item_name", "Title too long", { field: "title" }),
        vague,
      ],
      false,
      facts,
    );
    expect(fixes).toEqual([
      { kind: "brand", names: ["Brand Name"] },
      { kind: "mrp", names: ["Purchasable offer"] },
      { kind: "facts", names: ["Material"] },
      { kind: "admin", names: ["Strap Type", "Colour"] },
    ]);
    expect(otherIssues).toEqual([vague]);
  });

  it("leaves a barcode complaint to the barcode card, never the admin (2026-11-09: it was raised as a request)", () => {
    const barcode = issue("externally_assigned_product_identifier", "'Externally assigned product identifier' is required but missing.", { need: "barcode" });
    expect(fixesOf([barcode], true, facts)).toEqual({ fixes: [], otherIssues: [] });
  });

  it("leaves an offer complaint on the price when the product already has an MRP", () => {
    const offer = issue("purchasable_offer", "Price too low", { field: "price", need: "mrp" });
    expect(fixesOf([offer], true, facts)).toEqual({ fixes: [], otherIssues: [] });
  });
});
