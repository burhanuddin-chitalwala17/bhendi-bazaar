import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildProductSampleSheet } from "@server/catalog/bulk/sample-sheet";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

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
    madeOn: new Date("2026-10-30T00:00:00Z"),
    locationNames: ["Shop"],
    tabs: types.length
      ? types.map((t) => ({ name: t.label, type: t, categorySlugs: ["formal-ridas"] }))
      : [{ name: "Other", type: null, categorySlugs: ["formal-ridas"] }],
    values,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

const keysOf = (sheet: ExcelJS.Worksheet) => (sheet.getRow(2).values as unknown[]).map((v) => String(v ?? ""));

describe("the workbook a seller actually opens", () => {
  // Applying the dropdowns first materialises their rows, so a row added afterwards lands below
  // five hundred blanks — which is exactly what happened once.
  it("puts the example row directly under the help line, not below the dropdown range", async () => {
    const sheet = (await build()).getWorksheet("Islamic wear")!;
    expect(sheet.getRow(4).getCell(2).value).toBe("EXAMPLE — this row is skipped");
  });

  it("names its columns by key on the hidden row", async () => {
    const keys = keysOf((await build()).getWorksheet("Islamic wear")!);
    expect(keys).toContain("colour");
    expect(keys).toContain("length (in)");
    expect(keys).toContain("stock:Shop");
  });

  it("puts a dropdown on a choice column and none on a free one", async () => {
    const sheet = (await build()).getWorksheet("Islamic wear")!;
    const keys = keysOf(sheet);
    expect(sheet.getRow(5).getCell(keys.indexOf("colour")).dataValidation?.type).toBe("list");
    expect(sheet.getRow(5).getCell(keys.indexOf("name")).dataValidation).toBeUndefined();
  });

  // Nothing in this vocabulary blocks saving, so a dropdown must not force a choice either.
  it("lets every dropdown be left blank", async () => {
    const sheet = (await build()).getWorksheet("Islamic wear")!;
    expect(sheet.getRow(5).getCell(keysOf(sheet).indexOf("colour")).dataValidation?.allowBlank).toBe(true);
  });

  it("hides the lookup sheet, which is machinery rather than something to fill in", async () => {
    expect((await build()).getWorksheet("Lists")!.state).toBe("veryHidden");
  });

  it("builds a usable sheet for an org with no types at all", async () => {
    const keys = keysOf((await build([])).getWorksheet("Other")!);
    expect(keys).toContain("name");
    expect(keys).not.toContain("colour");
    expect(keys).not.toContain("kind");
  });
});
