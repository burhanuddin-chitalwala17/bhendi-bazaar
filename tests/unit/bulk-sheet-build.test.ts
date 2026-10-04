import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildProductSampleSheet } from "@server/catalog/bulk/sample-sheet";
import type { ProductTypeRecord } from "@server/catalog/product-type.types";

/**
 * The workbook itself, built and read back.
 *
 * `bulk-sheet-columns.test.ts` covers which columns there are; this covers that the file
 * actually comes out the way somebody opening it would see. The two are different failures: a
 * correct column list can still produce a workbook whose example rows sit below five hundred
 * blank ones, which is exactly what happened — applying the dropdowns first materialises those
 * rows, so `addRow` appends after them.
 */
const type = (over: Partial<ProductTypeRecord>): ProductTypeRecord => ({
  key: "islamic-wear",
  label: "Islamic wear",
  facts: ["colour", "material"],
  measures: [{ key: "length", label: "Length", unit: "in", required: true }],
  variantAxis: ["colour"],
  kinds: [{ key: "rida", label: "Rida" }],
  factLabels: { material: "Fabric" },
  labelFrom: ["length"],
  labelScale: null,
  ...over,
});

const values = {
  colour: [
    { key: "black", label: "Black" },
    { key: "maroon", label: "Maroon" },
  ],
  material: [{ key: "nida-matte", label: "Nida Matte" }],
};

async function build(types: ProductTypeRecord[] = [type({})]) {
  const buffer = await buildProductSampleSheet({
    orgName: "Test Org",
    locationNames: ["Shop"],
    categorySlugs: ["formal-ridas"],
    productTypes: types,
    values,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

describe("the workbook a seller actually opens", () => {
  it("puts the example rows directly under the header, not below the dropdown range", async () => {
    const sheet = (await build()).getWorksheet("Products")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("islamic-wear");
    expect(sheet.getRow(2).getCell(3).value).toBe("Example Product One");
    expect(sheet.getRow(3).getCell(3).value).toBe("Example Product Two");
  });

  it("names its columns in the header row", async () => {
    const sheet = (await build()).getWorksheet("Products")!;
    const headers = (sheet.getRow(1).values as unknown[]).filter(Boolean).map(String);
    expect(headers).toContain("productType");
    expect(headers).toContain("colour");
    expect(headers).toContain("length (in)");
    expect(headers).toContain("stock:Shop");
  });

  it("puts a dropdown on a choice column and none on a free one", async () => {
    const sheet = (await build()).getWorksheet("Products")!;
    const headers = (sheet.getRow(1).values as unknown[]).map((v) => String(v ?? ""));
    const colour = headers.indexOf("colour");
    const name = headers.indexOf("name");
    expect(sheet.getRow(5).getCell(colour).dataValidation?.type).toBe("list");
    expect(sheet.getRow(5).getCell(name).dataValidation).toBeUndefined();
  });

  // Nothing in this vocabulary blocks saving, so a dropdown must not force a choice either.
  it("lets every dropdown be left blank", async () => {
    const sheet = (await build()).getWorksheet("Products")!;
    const headers = (sheet.getRow(1).values as unknown[]).map((v) => String(v ?? ""));
    const colour = headers.indexOf("colour");
    expect(sheet.getRow(5).getCell(colour).dataValidation?.allowBlank).toBe(true);
  });

  it("carries a Types sheet saying which columns belong to which type", async () => {
    const sheet = (await build()).getWorksheet("Types")!;
    expect(sheet.getRow(2).getCell(1).value).toBe("islamic-wear");
    expect(String(sheet.getRow(2).getCell(3).value)).toContain("rida");
  });

  it("hides the lookup sheet, which is machinery rather than something to fill in", async () => {
    expect((await build()).getWorksheet("Answers")!.state).toBe("veryHidden");
  });

  it("builds a usable sheet for an org with no types at all", async () => {
    const workbook = await build([]);
    const sheet = workbook.getWorksheet("Products")!;
    const headers = (sheet.getRow(1).values as unknown[]).filter(Boolean).map(String);
    expect(headers).toContain("name");
    expect(headers).not.toContain("colour");
    expect(workbook.getWorksheet("Types")!.getRow(2).getCell(2).value).toContain("No product types");
  });
});
