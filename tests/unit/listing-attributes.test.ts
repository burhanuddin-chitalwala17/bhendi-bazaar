// What each marketplace's listing read becomes (marketplace-facts D1): the attributes flattened to
// paths, and the product details in our units. Shapes are the shop's own Amazon listings read on
// 2026-10-23 and Flipkart's documented listing details.
import { describe, expect, it } from "vitest";

import { amazonDetails, flattenAmazonAttributes } from "@server/channels/providers/amazon/amazon.listings";
import { flipkartDetails } from "@server/channels/providers/flipkart/flipkart.listings";

const M = "A21TJRUUN4KGV";

const prayerMat = {
  color: [{ language_tag: "en_IN", value: "Light Green", standardized_values: ["green"], marketplace_id: M }],
  material: [{ language_tag: "en_IN", value: "Cotton", marketplace_id: M }],
  closure: [{ type: [{ language_tag: "en_IN", value: "Zipper" }], marketplace_id: M }],
  sleeve: [{ length_description: [{ value: "long_sleeve" }], marketplace_id: M }],
  rug_form_type: [{ value: "prayer_rug", marketplace_id: M }],
  number_of_items: [{ value: 1, marketplace_id: M }],
  item_weight: [{ unit: "grams", value: 500, marketplace_id: M }],
  item_package_weight: [{ unit: "grams", value: 1000, marketplace_id: M }],
  item_dimensions: [{ height: { unit: "inches", value: 0.5 }, length: { unit: "inches", value: 42 }, width: { unit: "inches", value: 31 }, marketplace_id: M }],
  external_product_information: [{ entity: "HSN Code", value: "63049291", marketplace_id: M }],
  purchasable_offer: [{ currency: "INR", maximum_retail_price: [{ schedule: [{ value_with_tax: 1450 }] }] }],
  country_of_origin: [{ value: "IN", marketplace_id: M }],
  brand: [{ language_tag: "en_IN", value: "Generic", marketplace_id: M }],
  manufacturer: [{ language_tag: "en_IN", value: "Niqab Boutique", marketplace_id: M }],
  rtip_manufacturer_contact_information: [{ value: "Niqab Boutique 9930571034", marketplace_id: M }],
  packer_contact_information: [{ language_tag: "en_IN", value: "Niqab Boutique 9930571034", marketplace_id: M }],
};

describe("Amazon's attributes, flattened (D1)", () => {
  it("keeps each answer as written, nested parts as their own path, and the standard value beside it", () => {
    const flat = flattenAmazonAttributes(prayerMat);
    expect(flat.color).toEqual(["Light Green"]);
    expect(flat["color.standardized_values"]).toEqual(["green"]);
    expect(flat["closure.type"]).toEqual(["Zipper"]);
    expect(flat["sleeve.length_description"]).toEqual(["long_sleeve"]);
    expect(flat.rug_form_type).toEqual(["prayer_rug"]);
    expect(flat.number_of_items).toEqual(["1"]);
    expect(flat).not.toHaveProperty("color.marketplace_id");
    // Amazon's strict codes are said as yes or no here, so the shared fill knows no Amazon words.
    expect(flattenAmazonAttributes({ water_resistance_level: [{ value: "waterproof" }] })["water_resistance_level.standardized_values"]).toEqual(["yes"]);
  });

  it("is empty for nothing, never throws on an odd shape", () => {
    expect(flattenAmazonAttributes(null)).toEqual({});
    expect(flattenAmazonAttributes({ color: "not a list" })).toEqual({});
  });
});

describe("Amazon's product details, in our units (Q17, Q21)", () => {
  it("prefers the parcel weight, converts inches, reads MRP in paise, HSN, origin and the label", () => {
    expect(amazonDetails(prayerMat)).toEqual({
      weightKg: 1,
      dimensionsCm: { length: 106.7, width: 78.7, height: 1.3 },
      hsn: "63049291",
      mrpPaise: 145000,
      countryOfOrigin: "IN",
      brand: "Generic",
      manufacturer: "Niqab Boutique 9930571034",
      packer: "Niqab Boutique 9930571034",
      importer: null,
    });
  });

  it("falls back to the item's weight, and leaves what it cannot read empty", () => {
    const { item_package_weight: _p, ...rest } = prayerMat;
    expect(amazonDetails(rest).weightKg).toBe(0.5);
    expect(amazonDetails({ country_of_origin: [{ value: "India" }], item_weight: [{ unit: "stones", value: 3 }] })).toMatchObject({
      countryOfOrigin: null,
      weightKg: null,
      mrpPaise: null,
    });
  });
});

describe("Flipkart's product details from its listing (Q4, Q17)", () => {
  it("reads MRP, HSN, the parcel and the label though it has no attributes", () => {
    const details = flipkartDetails({
      price: { mrp: 1499, flipkart_selling_price: 1299 },
      tax: { hsn: "62114290", tax_code: "GST_5" },
      packages: [{ weight: 0.4, dimensions: { length: 30, breadth: 25, height: 3 } }],
      address_label: {
        manufacturer_details: ["Niqab Boutique, Mumbai 421201"],
        packer_details: "Niqab Boutique, Mumbai",
        importer_details: [],
        countries_of_origin: "IN",
      },
    });
    expect(details).toEqual({
      weightKg: 0.4,
      dimensionsCm: { length: 30, width: 25, height: 3 },
      hsn: "62114290",
      mrpPaise: 149900,
      countryOfOrigin: "IN",
      brand: null,
      manufacturer: "Niqab Boutique, Mumbai 421201",
      packer: "Niqab Boutique, Mumbai",
      importer: null,
    });
  });
});
