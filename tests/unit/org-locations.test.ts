// Pickup locations (stock-locations PR 3). Pinned: the two-envelope schema (create
// defaults, PATCH fires none — the PR-42 partial() lesson), the row→wire mapper,
// and the additive migration's load-bearing clauses: RESTRICT everywhere R8 lives,
// and the backfill's resolved-location logic.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  orgLocationSchema,
  updateOrgLocationSchema,
} from "@/lib/validation/schemas/location.schema";
import { toOrgLocation } from "@server/catalog/org.address.repository";

const valid = {
  name: "Bhendi Bazaar shop",
  contactName: "A Person",
  contactPhone: "9876543210",
  addressLine1: "12 Main St",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400003",
};

describe("orgLocationSchema", () => {
  it("accepts a complete location and defaults isActive to true", () => {
    expect(orgLocationSchema.parse(valid).isActive).toBe(true);
  });

  it("requires a courier-collectable address — street, city, state, valid pincode", () => {
    expect(() => orgLocationSchema.parse({ ...valid, addressLine1: "" })).toThrow();
    expect(() => orgLocationSchema.parse({ ...valid, pincode: "40000" })).toThrow();
  });

  it("requires a pickup contact with a real mobile", () => {
    expect(() => orgLocationSchema.parse({ ...valid, contactPhone: "12345" })).toThrow();
  });

  it("PATCH fires no defaults — unmentioned fields stay unmentioned", () => {
    expect(updateOrgLocationSchema.parse({ name: "Godown" })).toEqual({ name: "Godown" });
  });
});

describe("toOrgLocation", () => {
  it("flattens the address join and maps the R8-blocking counts", () => {
    const location = toOrgLocation({
      id: "oa-1",
      name: "Shop",
      contactName: "A Person",
      contactPhone: "9876543210",
      isActive: true,
      address: {
        addressLine1: "12 Main St",
        addressLine2: null,
        landmark: null,
        city: "Mumbai",
        state: "MH",
        pincode: "400003",
        country: "India",
      },
      _count: { productStock: 3, shipments: 7 },
    });
    expect(location).toMatchObject({
      id: "oa-1",
      addressLine2: undefined,
      pincode: "400003",
      stockedProducts: 3,
      shipmentCount: 7,
    });
  });
});

describe("the additive migration", () => {
  const sql = readFileSync(
    "prisma/migrations/20260810200000_org_addresses_and_product_stock/migration.sql",
    "utf8"
  );

  it("R8 lives in the database: RESTRICT on every link a location must survive", () => {
    expect(sql).toMatch(/OrgAddress_orgId_fkey"?\s+FOREIGN KEY \("orgId"\) REFERENCES "Org"\("id"\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/OrgAddress_addressId_fkey"?\s+FOREIGN KEY \("addressId"\) REFERENCES "Address"\("id"\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/ProductStock_orgAddressId_fkey"?\s+FOREIGN KEY \("orgAddressId"\) REFERENCES "OrgAddress"\("id"\) ON DELETE RESTRICT/);
    expect(sql).toMatch(/Shipment_orgAddressId_fkey"?\s+FOREIGN KEY \("orgAddressId"\) REFERENCES "OrgAddress"\("id"\) ON DELETE RESTRICT/);
  });

  it("stock is a composite-keyed join row, cascading only with its product", () => {
    expect(sql).toMatch(/PRIMARY KEY \("productId", "orgAddressId"\)/);
    expect(sql).toMatch(/ProductStock_productId_fkey"?\s+FOREIGN KEY \("productId"\) REFERENCES "Product"\("id"\) ON DELETE CASCADE/);
  });

  it("backfills an override location only when it differs from the org's default", () => {
    expect(sql).toMatch(/p\."shippingFromPincode" <> o\."defaultPincode"/);
  });

  it("resolves each product's stock to override else primary, carrying today's quantity", () => {
    expect(sql).toMatch(/THEN 'oa_' \|\| md5\('override:' \|\| p\."orgId" \|\| ':' \|\| p\."shippingFromPincode"\)/);
    expect(sql).toMatch(/ELSE 'oa_' \|\| md5\('org-default:' \|\| p\."orgId"\)/);
    expect(sql).toMatch(/p\."stock"\s+FROM "Product" p/);
  });

  it("reports what it did, loudly", () => {
    expect(sql).toContain("RAISE NOTICE");
  });
});
