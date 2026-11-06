/**
 * What publishing sends and how it reads the answer (marketplace-publish D2, D7, D8, D9). Pure
 * builders; no marketplace is called.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { amazonCreateBody, amazonIssues, amazonListingProblems, amazonPatches } from "@server/channels/providers/amazon/amazon.publish";
import { flipkartAnswer } from "@server/channels/providers/flipkart/flipkart.publish";
import { forwardAttributes, pickTheme, skuFor } from "@server/channels/listing-create";

const NOW = new Date("2026-11-02T10:00:00.000Z");

describe("Amazon's patch carries only what changed (D2)", () => {
  it("merges price into the offer with its selectors, never a full replace", () => {
    expect(amazonPatches({ price: 129_950, mrpPaise: null }, NOW)).toEqual([
      { op: "merge", path: "/attributes/purchasable_offer", value: [{ marketplace_id: "A21TJRUUN4KGV", currency: "INR", audience: "ALL", our_price: [{ schedule: [{ value_with_tax: 1299.5 }] }] }] },
    ]);
  });

  it("pauses by ending the offer and resumes by clearing the end, never by deleting (Q17)", () => {
    const [pause] = amazonPatches({ listed: false, mrpPaise: null }, NOW) as Array<{ value: Array<{ end_at: unknown }> }>;
    expect(pause.value[0].end_at).toEqual({ value: NOW.toISOString() });
    const [resume] = amazonPatches({ listed: true, mrpPaise: null }, NOW) as Array<{ value: Array<{ end_at: unknown }> }>;
    expect(resume.value[0].end_at).toBeNull();
  });

  it("puts the first photo as the main one and clears the slots no longer used", () => {
    const ops = amazonPatches({ photoUrls: ["https://cdn/a.jpg", "https://cdn/b.jpg"], mrpPaise: null }, NOW) as Array<{ op: string; path: string }>;
    expect(ops[0]).toMatchObject({ op: "replace", path: "/attributes/main_product_image_locator" });
    expect(ops[1]).toMatchObject({ op: "replace", path: "/attributes/other_product_image_locator_1" });
    expect(ops[2]).toMatchObject({ op: "delete", path: "/attributes/other_product_image_locator_2" });
    expect(ops).toHaveLength(9);
  });

  it("refuses photos with none left to send rather than reading them as sent", async () => {
    const { amazonPublish } = await import("@server/channels/providers/amazon/amazon.publish");
    const answer = await amazonPublish(async () => "t", "ACCT", { sku: "S", externalId: null, marketplaceType: "BAG" }, { photoUrls: [], mrpPaise: null });
    expect(answer).toEqual({ accepted: [], issues: [expect.objectContaining({ code: "no_photos", field: "photos" })], decidesLater: false });
  });

  it("sends nothing when nothing changed", () => {
    expect(amazonPatches({ mrpPaise: 249_900 }, NOW)).toEqual([]);
  });
});

describe("a new Amazon page (D6, D7, Q8)", () => {
  const base = {
    sku: "NBH0221", mode: "new" as const, targetExternalId: null, marketplaceType: "SCARF", family: null,
    title: "Crepe Hijab, Olive", price: 44_900, mrpPaise: 59_900, photoUrls: ["https://cdn/a.jpg"], features: ["Soft crepe"], description: "A crepe hijab.",
    barcode: null, brand: "Niqab Boutique", generic: false, quantity: 4, attributes: { color: "Green", "sleeve.type": "Long" },
    compliance: { countryOfOrigin: "IN", manufacturer: "Niqab Boutique, Bengaluru", packer: null, importer: null, hsn: "6214" },
  };

  it("asks for the brand's barcode exemption when the product has no barcode, and sends the barcode when it has one", () => {
    expect(amazonCreateBody(base).attributes).toHaveProperty("supplier_declared_has_product_identifier_exemption");
    const withBarcode = amazonCreateBody({ ...base, barcode: "8901234567890" }).attributes;
    expect(withBarcode).not.toHaveProperty("supplier_declared_has_product_identifier_exemption");
    expect(withBarcode.externally_assigned_product_identifier).toEqual([{ type: "ean", value: "8901234567890", marketplace_id: "A21TJRUUN4KGV" }]);
  });

  it("sells on an existing page with only the offer (offer-only requirements)", () => {
    const body = amazonCreateBody({ ...base, mode: "offer", targetExternalId: "B0C9QH21LM" });
    expect(body.requirements).toBe("LISTING_OFFER_ONLY");
    expect(Object.keys(body.attributes).sort()).toEqual(["condition_type", "fulfillment_availability", "merchant_suggested_asin", "purchasable_offer"]);
  });

  it("makes a family's page with no offer, and a member under it", () => {
    const parent = amazonCreateBody({ ...base, family: { role: "parent", theme: "COLOR_NAME" } }).attributes;
    expect(parent).not.toHaveProperty("purchasable_offer");
    expect(parent.parentage_level).toEqual([{ value: "parent", marketplace_id: "A21TJRUUN4KGV" }]);
    const child = amazonCreateBody({ ...base, family: { role: "child", parentSku: "FAM-1", theme: "COLOR_NAME" } }).attributes;
    expect(child.child_parent_sku_relationship).toEqual([{ child_relationship_type: "variation", parent_sku: "FAM-1", marketplace_id: "A21TJRUUN4KGV" }]);
  });
});

describe("a marketplace's complaints (D9, Q6)", () => {
  it("pins Amazon's errors and warnings to our fields, drops its notes, strips markup", () => {
    expect(
      amazonIssues([
        { code: "90220", message: "<b>Title</b> too long", severity: "ERROR", attributeNames: ["item_name"] },
        { code: "100708", message: "Price uncompetitive", severity: "WARNING", attributeNames: ["purchasable_offer"] },
        { code: "1", message: "FYI", severity: "INFO" },
        { code: "8541", message: "Catalog conflict", severity: "ERROR" },
      ]),
    ).toEqual([
      { code: "90220", message: "Title too long", severity: "error", field: "title", attribute: "item_name", need: null },
      { code: "100708", message: "Price uncompetitive", severity: "warning", field: "price", attribute: "purchasable_offer", need: "mrp" },
      { code: "8541", message: "Catalog conflict", severity: "error", field: null, attribute: null, need: null },
    ]);
  });

  it("says which complaints are the brand's details, and keeps the attribute it names (Q24)", () => {
    const [packer, strap] = amazonIssues([
      { code: "90220", message: "'Packer Contact Information' is required but missing.", severity: "ERROR", attributeNames: ["packer_contact_information"] },
      { code: "90220", message: "'Strap Type' is required but missing.", severity: "ERROR", attributeNames: ["strap_type"] },
    ]);
    expect(packer).toMatchObject({ field: null, attribute: "packer_contact_information", need: "brand" });
    expect(strap).toMatchObject({ field: null, attribute: "strap_type", need: null });
  });

  it("reads Flipkart's per-SKU answer: a failure is a refusal even with an HTTP 200", () => {
    expect(flipkartAnswer({ A1: { status: "SUCCESS" } }, "A1", "price")).toEqual({ ok: true, issues: [] });
    const failed = flipkartAnswer({ A1: { status: "FAILURE", errors: [{ code: "PRICE_INVALID", description: "Selling price above MRP" }] } }, "A1", "price");
    expect(failed).toEqual({ ok: false, issues: [{ code: "PRICE_INVALID", message: "Selling price above MRP", severity: "error", field: "price" }] });
  });
});

describe("turning a product into a new listing (D7, D8)", () => {
  it("sends a listed answer as the marketplace's word, free text as typed, and leaves out an answer with no word", () => {
    const facts = { colour: { value: "olive", origin: "shop" }, pattern: { value: "plaid", origin: "shop" } };
    const attributes = [
      { theirCategory: "SCARF", fact: "colour", theirAttribute: "color" },
      { theirCategory: "SCARF", fact: "pattern", theirAttribute: "pattern" },
      { theirCategory: "ABAYA", fact: "colour", theirAttribute: "colour_name" },
    ];
    const values = [{ list: "colour", valueKey: "olive", theirValue: "Green" }];
    expect(forwardAttributes("SCARF", attributes, values, facts)).toEqual({ color: "Green" });
  });

  it("picks the single-axis theme that holds the family's axis, and none when nothing fits", () => {
    expect(pickTheme(["colour"], ["SIZE_NAME/COLOR_NAME", "COLOR_NAME", "SIZE_NAME"])).toBe("COLOR_NAME");
    expect(pickTheme(["size"], ["COLOR_NAME"])).toBeNull();
  });

  it("gives a product with no SKU one from its id", () => {
    expect(skuFor({ id: "cmt32hxzc000304l3fj9lhaew", sku: null })).toBe("BB-L3FJ9LHAEW");
    expect(skuFor({ id: "x", sku: "NBH0221" })).toBe("NBH0221");
  });
});

describe("Amazon's daily problems look (marketplace-publish Q23)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks only for listings with errors, follows every page, and reads a suppression from its enforcement", async () => {
    const asked: URL[] = [];
    const pages = [
      {
        items: [
          { sku: "A", issues: [{ code: "18027", message: "Main image missing", severity: "ERROR", attributeNames: ["main_product_image_locator"], enforcements: { actions: [{ action: "LISTING_SUPPRESSED" }] } }] },
          { sku: "B", issues: [{ code: "1", message: "Consider a lower price", severity: "WARNING" }] },
        ],
        pagination: { nextToken: "t2" },
      },
      { items: [{ sku: "C", issues: [{ code: "8541", message: "Brand not approved", severity: "ERROR" }] }] },
    ];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(new URL(url));
      return new Response(JSON.stringify(pages[asked.length - 1]), { status: 200 });
    });
    const problems = await amazonListingProblems(async () => "token", "SELLER");
    expect(asked).toHaveLength(2);
    expect(asked[0].searchParams.get("withIssueSeverity")).toBe("ERROR");
    expect(asked[0].searchParams.get("includedData")).toBe("summaries,issues");
    expect(asked[1].searchParams.get("pageToken")).toBe("t2");
    expect(problems).toEqual([
      { sku: "A", suppressed: true, issues: [{ code: "18027", message: "Main image missing", severity: "error", field: "photos", attribute: "main_product_image_locator", need: null }] },
      { sku: "C", suppressed: false, issues: [{ code: "8541", message: "Brand not approved", severity: "error", field: null, attribute: null, need: null }] },
    ]);
  });
});

describe("an unregistered brand on Amazon (setup-requests Q35)", () => {
  const input = {
    sku: "NBH0221", mode: "new" as const, targetExternalId: null, marketplaceType: "SCARF", family: null,
    title: "Crepe Hijab", price: 44_900, mrpPaise: 59_900, photoUrls: ["https://cdn/a.jpg"], features: [], description: "x",
    barcode: null, brand: "Niqab Boutique", generic: true, quantity: 1, attributes: {},
    compliance: { countryOfOrigin: "IN", manufacturer: null, packer: null, importer: null, hsn: null },
  };
  it("lists as Generic, never under the shop's unregistered brand, and takes the barcode exemption", () => {
    const attrs = amazonCreateBody(input).attributes;
    expect(attrs.brand).toEqual([{ value: "Generic", language_tag: "en_IN", marketplace_id: "A21TJRUUN4KGV" }]);
    expect(attrs.supplier_declared_has_product_identifier_exemption).toBeDefined();
    expect(amazonCreateBody({ ...input, generic: false }).attributes.brand).toEqual([{ value: "Niqab Boutique", language_tag: "en_IN", marketplace_id: "A21TJRUUN4KGV" }]);
  });
});
