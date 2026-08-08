// The address book's two contracts: the row→wire mapper (phone→mobile, label/notes
// top-level — the blob's metadata bag is gone), and the migration's coalescing rules
// across the four blob shapes observed in production. The SQL itself is database
// behaviour; what a test CAN pin is that every observed variant key is coalesced,
// so an edit to the migration cannot silently drop one.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toDeliveryAddress } from "@server/identity/address.repository";

describe("toDeliveryAddress", () => {
  const row = {
    id: "ua-1",
    label: "Home",
    fullName: "A Buyer",
    phone: "9876543210",
    email: null,
    notes: "Ring twice",
    address: {
      id: "addr-1",
      addressLine1: "12 Main St",
      addressLine2: null,
      landmark: "Near the mosque",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400003",
      country: "India",
    },
  };

  it("flattens the join into the wire shape the client always used", () => {
    const wire = toDeliveryAddress(row);
    expect(wire).toEqual({
      id: "ua-1", // the UserAddress id, not the postal row's
      fullName: "A Buyer",
      mobile: "9876543210", // column is phone; wire stays mobile (trd.md D4)
      email: undefined,
      addressLine1: "12 Main St",
      addressLine2: undefined,
      landmark: "Near the mosque",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400003",
      country: "India",
      label: "Home",
      notes: "Ring twice",
    });
  });

  it("has no metadata bag — label and notes are first-class", () => {
    expect(toDeliveryAddress(row)).not.toHaveProperty("metadata");
  });
});

describe("the migration coalesces every observed blob variant", () => {
  const sql = readFileSync(
    "prisma/migrations/20260810090000_addresses_as_entities/migration.sql",
    "utf8"
  );

  it("recipient: fullName | name, with '' rather than dropping the row", () => {
    expect(sql).toContain("COALESCE(elem->>'fullName', elem->>'name', '')");
  });

  it("phone: mobile | phone", () => {
    expect(sql).toContain("COALESCE(elem->>'mobile', elem->>'phone', '')");
  });

  it("label: top-level | metadata.label", () => {
    expect(sql).toContain("COALESCE(elem->>'label', elem->'metadata'->>'label')");
  });

  it("notes come from metadata; isDefault is deliberately not migrated", () => {
    expect(sql).toContain("elem->'metadata'->>'notes'");
    // No column receives it and no expression extracts it — the comment may name it.
    expect(sql).not.toContain("elem->>'isDefault'");
    expect(sql).not.toContain('"isDefault"');
  });
});
