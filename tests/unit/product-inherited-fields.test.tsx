/**
 * A product overriding what its brand fills (listing-model/dynamic-form A4, ux journey 3): it reads where the value
 * comes from, Change makes it the product's own, "Use brand's" clears it so the brand's applies again.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";

import type { ProductFormInput } from "@/components/product/console/types";
import type { BrandDto } from "@server/catalog/brand.types";
import { ProductInheritedFields } from "@/components/shared/forms/product/ProductInheritedFields";
import { inheritedFrom } from "@/components/shared/forms/product/inherited-answers";
import { complianceFor } from "@server/channels/listing-create";

const noor: BrandDto = {
  id: "b1", name: "Noor", manufacturer: "Old line", packerOrImporter: null, countryOfOrigin: "IN", isDefault: true, amazonRegistered: true, retiredAt: null,
  parties: { maker: { name: "Noor Works", address: "Mumbai", pincode: "400003" }, packer: { name: null, address: null, pincode: null }, importer: { name: null, address: null, pincode: null } },
};

let seen: ProductFormInput["facts"] = {};
function Harness({ facts = {} }: { facts?: Record<string, string> }) {
  const form = useForm<ProductFormInput>({ defaultValues: { brandId: null, facts } as never });
  seen = form.watch("facts");
  return <ProductInheritedFields control={form.control} setValue={form.setValue} brands={[noor]} shopCountry="AE" />;
}

describe("inherited answers on the product form (A4)", () => {
  it("says which brand fills each, and the shop where the brand is silent", () => {
    render(<Harness />);
    expect(screen.getByText("From your brand Noor: India")).toBeTruthy();
    expect(screen.getByText("From your brand Noor: Noor Works, Mumbai, 400003")).toBeTruthy();
    expect(screen.getAllByText("Your brand Noor doesn't say").length).toBe(2);
  });

  it("Change makes it the product's own; Use brand's goes back", () => {
    render(<Harness />);
    fireEvent.click(screen.getAllByRole("button", { name: "Change" })[1]);
    fireEvent.change(screen.getByPlaceholderText("Name, address, pincode"), { target: { value: "Gulf Works, Dubai" } });
    expect(seen?.manufacturer).toBe("Gulf Works, Dubai");
    expect(screen.getByText("Set on this product")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use brand's" }));
    expect(seen?.manufacturer).toBeNull();
    expect(screen.getByText("From your brand Noor: Noor Works, Mumbai, 400003")).toBeTruthy();
  });

  it("opens on the product's own answer when it has one", () => {
    render(<Harness facts={{ packer: "Own Packing, Surat" }} />);
    expect(screen.getByDisplayValue("Own Packing, Surat")).toBeTruthy();
  });

  it("falls to the shop's country when the brand names none", () => {
    expect(inheritedFrom([{ ...noor, countryOfOrigin: null }], null, "AE").countryOfOrigin).toEqual({ value: "AE", level: "shop", name: null });
  });
});

describe("what a create sends (A4)", () => {
  const brand = { manufacturer: "Old line", packerOrImporter: "Noor Packing", countryOfOrigin: "IN", parties: [] };
  it("sends the product's own answer over its brand's and the shop's", () => {
    expect(complianceFor({ countryOfOrigin: { value: "BD", origin: "product" }, packer: { value: "Own Packing", origin: "product" } }, brand, "AE"))
      .toEqual({ countryOfOrigin: "BD", manufacturer: "Old line", packer: "Own Packing", importer: null });
  });
  it("sends the brand's, then the shop's country, when the product sets none", () => {
    expect(complianceFor({}, brand, "AE")).toMatchObject({ countryOfOrigin: "IN", packer: "Noor Packing" });
    expect(complianceFor({ countryOfOrigin: { value: "  ", origin: "product" } }, { ...brand, countryOfOrigin: null }, "AE").countryOfOrigin).toBe("AE");
  });
});
