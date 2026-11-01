import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildProductSampleSheet, EXAMPLE_MARKER } from "@server/catalog/bulk/sample-sheet";
import { groupForTicking, planSheetTabs } from "@server/catalog/bulk/sheet-tabs";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { parseBulkProductRow } from "@/lib/validation/schemas/bulk-product.schema";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * own-store/bulk-sheet U1: the download a shop asks for by ticking categories — Instructions
 * first, a tab per type, a hidden key row, a help line and one example row the upload skips.
 */
const type = (over: Partial<ProductTypeRecord>): ProductTypeRecord => ({
  key: "t",
  label: "T",
  facts: [],
  measures: [],
  variantAxis: [],
  kinds: [],
  factLabels: {},
  labelFrom: [],
  labelScale: null,
  ...over,
});

const abaya = type({
  key: "abaya",
  label: "Abaya",
  facts: ["colour", "material"],
  factLabels: { material: "Fabric" },
  measures: [{ key: "length", label: "Length", unit: "in", required: true }],
  kinds: [{ key: "abaya", label: "Abaya" }],
});
const attar = type({ key: "attar", label: "Attar", facts: ["colour"] });

const categories = [
  { id: "women", parentId: null, slug: "women", productType: null },
  { id: "abayas", parentId: "women", slug: "abayas", productType: "abaya" },
  { id: "kaftans", parentId: "abayas", slug: "kaftans", productType: null },
  { id: "attar", parentId: null, slug: "attar", productType: "attar" },
  { id: "gifts", parentId: null, slug: "gifts", productType: null },
];
const types = [abaya, attar];

const values = {
  colour: [{ key: "black", label: "Black" }],
  material: [{ key: "nida", label: "Nida" }],
};

async function workbookFor(tickedIds: string[], locationNames = ["Shop"]) {
  const buffer = await buildProductSampleSheet({
    orgName: "Noor",
    madeOn: new Date("2026-10-30T10:00:00Z"),
    locationNames,
    tabs: planSheetTabs(tickedIds, categories, types),
    values,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return { buffer, workbook };
}

const rowValues = (sheet: ExcelJS.Worksheet, row: number) =>
  (sheet.getRow(row).values as unknown[]).slice(1).map((v) => String(v ?? ""));

describe("R1 — tabs follow the ticked categories", () => {
  it("groups ticks by the type each category resolves to, inherited from its parent", () => {
    const tabs = planSheetTabs(["kaftans", "abayas", "attar"], categories, types);
    expect(tabs.map((tab) => tab.name)).toEqual(["Abaya", "Attar"]);
    expect(tabs[0].categorySlugs).toEqual(["abayas", "kaftans"]);
  });

  it("puts a ticked category with no type on an Other tab, last", () => {
    const tabs = planSheetTabs(["gifts", "attar"], categories, types);
    expect(tabs.map((tab) => tab.name)).toEqual(["Attar", "Other"]);
    expect(tabs[1].type).toBeNull();
  });

  it("makes one Other tab of every category when nothing is ticked", () => {
    const tabs = planSheetTabs([], categories, types);
    expect(tabs).toHaveLength(1);
    expect(tabs[0].name).toBe("Other");
    expect(tabs[0].categorySlugs).toHaveLength(categories.length);
  });

  it("ignores an id that is not a category", () => {
    expect(planSheetTabs(["nope", "attar"], categories, types).map((t) => t.name)).toEqual(["Attar"]);
  });
});

describe("R1 — the ticks, grouped by the tab each makes", () => {
  it("names each category by its path, so look-alike names stay apart (Q6)", () => {
    const named = categories.map((c) => ({ ...c, name: c.id === "kaftans" ? "Rings" : c.id[0].toUpperCase() + c.id.slice(1) }));
    const groups = groupForTicking([...named, { id: "rings", parentId: "attar", slug: "rings", name: "Rings", productType: null }], types);
    expect(groups.map((g) => g.label)).toEqual(["Abaya", "Attar", "Other"]);
    expect(groups[0].categories.map((c) => c.path)).toEqual(["Women › Abayas", "Women › Abayas › Rings"]);
    expect(groups[1].categories.map((c) => c.path)).toContain("Attar › Rings");
  });
});

describe("A1 — Instructions first, then a tab per type", () => {
  it("opens on Instructions, then Abaya and Attar", async () => {
    const { workbook } = await workbookFor(["abayas", "attar"]);
    const visible = workbook.worksheets.filter((sheet) => sheet.state === "visible");
    expect(visible.map((sheet) => sheet.name)).toEqual(["Instructions", "Abaya", "Attar"]);
  });

  it("asks Fabric on Abaya, with a dropdown, and nothing about fabric on Attar", async () => {
    const { workbook } = await workbookFor(["abayas", "attar"]);
    const abayaTab = workbook.getWorksheet("Abaya")!;
    const keys = rowValues(abayaTab, 2);
    expect(rowValues(abayaTab, 1)).toContain("Fabric");
    const material = keys.indexOf("material") + 1;
    expect(abayaTab.getCell(5, material).dataValidation?.type).toBe("list");
    expect(rowValues(workbook.getWorksheet("Attar")!, 2)).not.toContain("material");
  });

  it("offers on each tab's category dropdown only that tab's ticked categories (D1)", async () => {
    const { workbook } = await workbookFor(["abayas", "attar"]);
    const tab = workbook.getWorksheet("Attar")!;
    const category = rowValues(tab, 2).indexOf("category") + 1;
    const [range] = tab.getCell(5, category).dataValidation!.formulae as string[];
    const [, letter, from, to] = /^Lists!\$([A-Z]+)\$(\d+):\$[A-Z]+\$(\d+)$/.exec(range)!;
    const lists = workbook.getWorksheet("Lists")!;
    const offered = [];
    for (let row = Number(from); row <= Number(to); row += 1) offered.push(lists.getCell(`${letter}${row}`).value);
    // A tab with no category paths given shows its slugs; bulk-sheet-lists covers the paths.
    expect(offered).toEqual(["attar"]);
  });
});

describe("R3 — each tab's layout (D2)", () => {
  it("puts Problems in column A, keys on a hidden row 2 and a help line on row 3", async () => {
    const { workbook } = await workbookFor(["abayas"]);
    const tab = workbook.getWorksheet("Abaya")!;
    expect(tab.getCell("A1").value).toBe("Problems");
    expect(tab.getCell("A4").value ?? null).toBeNull();
    expect(tab.getRow(2).hidden).toBe(true);
    expect(rowValues(tab, 2)).toEqual(expect.arrayContaining(["name", "price", "category", "stock:Shop"]));
    expect(rowValues(tab, 3).every((help, index) => index === 0 || help.length > 0)).toBe(true);
  });

  it("colours a required heading and leaves an optional one plain", async () => {
    const { workbook } = await workbookFor(["abayas"]);
    const tab = workbook.getWorksheet("Abaya")!;
    const keys = rowValues(tab, 2);
    const fill = (key: string) => (tab.getCell(1, keys.indexOf(key) + 1).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb;
    expect(fill("price")).toBeDefined();
    expect(fill("length (in)")).toBe(fill("price"));
    expect(fill("tags")).toBeUndefined();
  });

  it("freezes the headings and the Problems column", async () => {
    const { workbook } = await workbookFor(["abayas"]);
    expect(workbook.getWorksheet("Abaya")!.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 3 });
  });

  it("starts with one example row whose first data cell says it is skipped", async () => {
    const { workbook } = await workbookFor(["abayas"]);
    const tab = workbook.getWorksheet("Abaya")!;
    expect(tab.getCell("B4").value).toBe(EXAMPLE_MARKER);
    expect(EXAMPLE_MARKER).toBe("EXAMPLE — this row is skipped");
    expect(tab.getRow(5).getCell(3).value ?? null).toBeNull();
  });
});

describe("R11 — the Video column says YouTube only", () => {
  it("carries Q25's help line under Video", async () => {
    const { workbook } = await workbookFor(["abayas"]);
    const tab = workbook.getWorksheet("Abaya")!;
    const video = rowValues(tab, 2).indexOf("video") + 1;
    expect(tab.getCell(3, video).value).toBe(
      "YouTube link only. Add a video file from the product form after upload.",
    );
  });

  it("says so on Instructions, with the made-on date", async () => {
    const { workbook } = await workbookFor(["abayas"]);
    const text = workbook.getWorksheet("Instructions")!.getColumn(1).values.map(String).join("\n");
    expect(text).toContain("How to fill this sheet");
    expect(text).toContain("Video: a YouTube link only. Add a video file from the product form after upload.");
    expect(text).toContain("Orange heading = must fill");
    expect(text).toContain("Made 30 Oct 2026");
    expect(text).toContain("Download a fresh sheet each time — our lists change.");
  });
});

describe("A5 — the example row, left in, creates nothing", () => {
  it("refuses a sheet holding only the example, saying the example is skipped", async () => {
    const { buffer } = await workbookFor(["abayas", "attar"]);
    await expect(parseSheet(buffer, "sheet.xlsx")).rejects.toThrow(
      "Your sheet has no products yet — the example row is skipped.",
    );
  });

  it("reads every type tab by its key row, past the help line, skipping the example", async () => {
    const { workbook } = await workbookFor(["abayas", "attar"]);
    for (const name of ["Abaya", "Attar"]) {
      const tab = workbook.getWorksheet(name)!;
      const keys = rowValues(tab, 2);
      // A seller who renames a heading does not break the sheet.
      tab.getCell(1, keys.indexOf("name") + 1).value = "What is it called";
      tab.getCell(5, keys.indexOf("name") + 1).value = `Real ${name}`;
      tab.getCell(5, 1).value = "an old problem note";
    }
    const filled = Buffer.from(await workbook.xlsx.writeBuffer());
    const sheet = await parseSheet(filled, "sheet.xlsx");
    expect(sheet.rows.map((row) => row.cells.name)).toEqual(["Real Abaya", "Real Attar"]);
    expect(sheet.rows[0].rowNumber).toBe(5);
    expect(sheet.rows[0].cells).not.toHaveProperty("problems");
  });

  // Two tabs share row numbers, so a row is named by its tab too.
  it("names each row's tab", async () => {
    const { workbook } = await workbookFor(["abayas", "attar"]);
    for (const name of ["Abaya", "Attar"]) {
      const tab = workbook.getWorksheet(name)!;
      tab.getCell(5, rowValues(tab, 2).indexOf("name") + 1).value = `Real ${name}`;
    }
    const sheet = await parseSheet(Buffer.from(await workbook.xlsx.writeBuffer()), "sheet.xlsx");
    expect(sheet.rows.map((row) => `${row.tab}!${row.rowNumber}`)).toEqual(["Abaya!5", "Attar!5"]);
  });

  it("still reads a tab whose Problems column was deleted, never Instructions", async () => {
    const { workbook } = await workbookFor(["attar"]);
    const tab = workbook.getWorksheet("Attar")!;
    tab.spliceColumns(1, 1);
    tab.getCell(5, rowValues(tab, 2).indexOf("name") + 1).value = "Rose attar";
    const sheet = await parseSheet(Buffer.from(await workbook.xlsx.writeBuffer()), "sheet.xlsx");
    expect(sheet.rows.map((row) => row.cells.name)).toEqual(["Rose attar"]);
  });

  // A seller who types over the marker has made the row their own.
  it("reads the example row once its marker is gone", async () => {
    const { workbook } = await workbookFor(["attar"]);
    workbook.getWorksheet("Attar")!.getCell("B4").value = "Rose attar";
    const sheet = await parseSheet(Buffer.from(await workbook.xlsx.writeBuffer()), "sheet.xlsx");
    expect(sheet.rows.map((row) => row.rowNumber)).toEqual([4]);
  });
});

describe("A8 — a file name in Video says where a video file goes", () => {
  it("names the value and the product form", () => {
    const parsed = parseBulkProductRow({ rowNumber: 7, cells: { video: "clip.mp4" } });
    expect("errors" in parsed && parsed.errors).toContainEqual({
      row: 7,
      field: "video",
      message: 'Not a YouTube link: "clip.mp4" — add a video file from the product form after upload',
    });
  });
});
