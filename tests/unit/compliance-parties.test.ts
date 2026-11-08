/**
 * Who makes, packs and imports a product, as Amazon is told (listing-model/attributes D6, Q11; dynamic-form
 * unit 4): each line from its own party, importer never from the packer.
 */
import { describe, expect, it } from "vitest";

import { complianceParties } from "@server/channels/listing-create";
import { toBrandDto } from "@server/catalog/brand.types";

const party = (role: string, name: string | null, address: string | null = null, pincode: string | null = null) => ({ role, name, address, pincode });

describe("the compliance lines a create sends", () => {
  it("takes each line from its own party, with address and pincode", () => {
    expect(complianceParties({ manufacturer: "Noor Works", packerOrImporter: "Noor Packing", parties: [
      party("maker", "Noor Works", "12 Bhendi Bazaar, Mumbai", "400003"), party("packer", "Noor Packing"), party("importer", "Gulf Imports", null, "400001"),
    ] })).toEqual({ manufacturer: "Noor Works, 12 Bhendi Bazaar, Mumbai, 400003", packer: "Noor Packing", importer: "Gulf Imports, 400001" });
  });

  it("never declares a domestic brand's packer as its importer, and falls back to the old lines for maker and packer", () => {
    expect(complianceParties({ manufacturer: "Old Maker", packerOrImporter: "Old Packer", parties: [] })).toEqual({ manufacturer: "Old Maker", packer: "Old Packer", importer: null });
    expect(complianceParties(null)).toEqual({ manufacturer: null, packer: null, importer: null });
  });
});

describe("a brand as the form shows it", () => {
  const base = { id: "b1", orgId: "o1", name: "Noor", manufacturer: "Old Maker", packerOrImporter: null, countryOfOrigin: null, isDefault: false, amazonRegistered: true, retiredAt: null, createdAt: new Date(), updatedAt: new Date() };
  const row = (role: string, name: string | null, address: string | null) => ({ id: role, brandId: "b1", role, name, address, pincode: null, createdAt: new Date(), updatedAt: new Date() });

  it("keeps a party that has an address but no name, so the next save does not delete it", () => {
    expect(toBrandDto({ ...base, parties: [row("maker", null, "12 Bhendi Bazaar")] }).parties.maker).toEqual({ name: null, address: "12 Bhendi Bazaar", pincode: null });
  });

  it("reads the old maker line while the brand has no maker party", () => {
    expect(toBrandDto({ ...base, parties: [] }).parties.maker).toEqual({ name: "Old Maker", address: null, pincode: null });
  });
});
