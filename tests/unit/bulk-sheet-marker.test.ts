import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildProductSampleSheet } from "@server/catalog/bulk/sample-sheet";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { markProblems, MARK_ARGB } from "@server/catalog/bulk/sheet-marker";
import { markedFileName } from "@server/catalog/bulk/sheet-copy";
import type { RowError } from "@server/catalog/bulk/bulk.types";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import { parseBulkProductRow } from "@/lib/validation/schemas/bulk-product.schema";

/**
 * own-store/bulk-sheet U4: the shop's own file comes back with its problems marked (R6, A4, D7),
 * and nothing else in it moves — the only way "upload the same file again" can work.
 */
const TAB = "Abaya";
const abaya: ProductTypeRecord = {
  key: "abaya",
  label: TAB,
  facts: ["colour"],
  measures: [],
  variantAxis: [],
  kinds: [],
  factLabels: {},
  labelFrom: [],
  labelScale: null,
};

async function sheetWithRows() {
  const built = await buildProductSampleSheet({
    orgName: "Test Org",
    madeOn: new Date("2026-10-30T00:00:00Z"),
    locationNames: ["Shop"],
    tabs: [{ name: TAB, type: abaya, categorySlugs: ["abayas"] }],
    values: { colour: [{ key: "emerald", label: "Emerald" }] },
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(built as unknown as ArrayBuffer);
  const tab = workbook.getWorksheet(TAB)!;
  const keys = (tab.getRow(2).values as unknown[]).map((v) => String(v ?? "").toLowerCase());
  const col = (key: string) => keys.indexOf(key);
  const fill = (row: number, cells: Record<string, string | number>) =>
    Object.entries(cells).forEach(([key, value]) => (tab.getCell(row, col(key)).value = value));
  fill(7, { name: "Emerald Abaya", description: "d", category: "abayas", weight: 1, images: "a.jpg", colour: "Emrald" });
  fill(8, { name: "Black Abaya", description: "d", price: 999, category: "abayas", weight: 1, images: "b.jpg" });
  // The shop's own formatting, which the returned file must keep.
  tab.getCell(8, col("name")).font = { bold: true };
  tab.getCell(8, col("price")).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
  return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), col };
}

const A4_ERRORS: RowError[] = [
  { row: 7, tab: TAB, field: "price", message: "Price missing" },
  { row: 7, tab: TAB, field: "colour", message: "Colour 'Emrald' isn't in the list — pick from the dropdown" },
];

async function load(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

const argb = (cell: ExcelJS.Cell) => (cell.fill?.type === "pattern" ? cell.fill.fgColor?.argb : undefined);
const noteOf = (cell: ExcelJS.Cell) =>
  typeof cell.note === "string" ? cell.note : (cell.note?.texts ?? []).map((t) => t.text).join("");

/** Every value of every tab but the Problems column, so "nothing else moved" is checked whole. */
async function valuesBesideProblems(buffer: Buffer) {
  const workbook = await load(buffer);
  return workbook.worksheets.map((sheet) => {
    const rows: unknown[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, n) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        if (!(sheet.name === TAB && c === 1 && n > 4)) rows.push([n, c, cell.value]);
      });
    });
    return [sheet.name, sheet.state, rows];
  });
}

describe("A4 — problems come back in the shop's own file", () => {
  it("fills the two bad cells red with notes and writes row 7's Problems cell", async () => {
    const { buffer, col } = await sheetWithRows();
    const tab = (await load(await markProblems(buffer, "my sheet.xlsx", A4_ERRORS))).getWorksheet(TAB)!;
    expect(tab.getCell(7, 1).value).toBe(
      "Price missing · Colour 'Emrald' isn't in the list — pick from the dropdown",
    );
    expect(argb(tab.getCell(7, 1))).toBe(MARK_ARGB);
    expect(argb(tab.getCell(7, col("price")))).toBe(MARK_ARGB);
    expect(noteOf(tab.getCell(7, col("price")))).toBe("Price missing");
    expect(argb(tab.getCell(7, col("colour")))).toBe(MARK_ARGB);
    expect(argb(tab.getCell(7, col("name")))).toBeUndefined();
  });

  it("leaves a row without problems plain, and keeps the shop's own values, tabs and formatting", async () => {
    const { buffer, col } = await sheetWithRows();
    const marked = await markProblems(buffer, "my sheet.xlsx", A4_ERRORS);
    const tab = (await load(marked)).getWorksheet(TAB)!;
    expect(tab.getCell(8, 1).value).toBeNull();
    expect(tab.getCell(8, col("name")).font?.bold).toBe(true);
    expect(argb(tab.getCell(8, col("price")))).toBe("FFFFFF00");
    expect(tab.getCell(9, col("colour")).dataValidation?.type).toBe("list");
    expect(await valuesBesideProblems(marked)).toEqual(await valuesBesideProblems(buffer));
  });

  it("reads back as the same rows and the same stamp, so the same file uploads again", async () => {
    const { buffer } = await sheetWithRows();
    const before = await parseSheet(buffer, "my sheet.xlsx");
    const after = await parseSheet(await markProblems(buffer, "my sheet.xlsx", A4_ERRORS), "my sheet.xlsx");
    expect(after.rows).toEqual(before.rows);
    expect(after.stamp).toEqual(before.stamp);
    expect(after.tabs).toEqual(before.tabs);
  });

  it("clears last round's marks when the fixed file is marked again", async () => {
    const { buffer, col } = await sheetWithRows();
    const once = await markProblems(buffer, "s.xlsx", A4_ERRORS);
    const tab = (await load(await markProblems(once, "s.xlsx", [A4_ERRORS[1]]))).getWorksheet(TAB)!;
    expect(tab.getCell(7, 1).value).toBe(A4_ERRORS[1].message);
    expect(argb(tab.getCell(7, col("price")))).toBeUndefined();
    expect(noteOf(tab.getCell(7, col("price")))).toBe("");
    expect(argb(tab.getCell(7, col("colour")))).toBe(MARK_ARGB);
    // Only our own red is cleared: the shop's yellow is its own.
    expect(argb(tab.getCell(8, col("price")))).toBe("FFFFFF00");
  });

  it("keeps the shop's own Bad-style red and note lines when marking again", async () => {
    const { buffer, col } = await sheetWithRows();
    const once = await load(await markProblems(buffer, "s.xlsx", A4_ERRORS));
    const tab = once.getWorksheet(TAB)!;
    // The shop's own red, Excel's "Bad" style, with its own note, on a row we marked and one we did not.
    for (const row of [7, 8]) {
      const cell = tab.getCell(row, col("description"));
      cell.style = { ...cell.style, fill: { type: "pattern", pattern: "solid", fgColor: { argb: MARK_ARGB } } };
      cell.note = "check with supplier";
    }
    tab.getCell(7, col("colour")).note = `${A4_ERRORS[1].message}\nask dad`;
    const again = (await load(await markProblems(Buffer.from(await once.xlsx.writeBuffer()), "s.xlsx", []))).getWorksheet(TAB)!;
    for (const row of [7, 8]) {
      expect(argb(again.getCell(row, col("description")))).toBe(MARK_ARGB);
      expect(noteOf(again.getCell(row, col("description")))).toBe("check with supplier");
    }
    expect(argb(again.getCell(7, col("colour")))).toBeUndefined();
    expect(noteOf(again.getCell(7, col("colour")))).toBe("ask dad");
    expect(argb(again.getCell(7, col("price")))).toBeUndefined();
  });

  it("A8 — marks the Video cell with the YouTube-only line", async () => {
    const { buffer, col } = await sheetWithRows();
    const message = 'Not a YouTube link: "clip.mp4" — add a video file from the product form after upload';
    const tab = (await load(await markProblems(buffer, "s.xlsx", [{ row: 8, tab: TAB, field: "video", message }]))).getWorksheet(TAB)!;
    expect(argb(tab.getCell(8, col("video")))).toBe(MARK_ARGB);
    expect(tab.getCell(8, 1).value).toBe(message);
  });
});

describe("Q30 — a .csv comes back as an .xlsx of its own cells", () => {
  const csv = Buffer.from("name,price,category\nRida,,abayas\nShawl,500,abayas\n");

  it("puts Problems first and marks the bad cell, and reads back as the same rows", async () => {
    const marked = await markProblems(csv, "list.csv", [{ row: 2, field: "price", message: "Price missing" }]);
    const sheet = (await load(marked)).worksheets[0];
    expect(sheet.getCell("A1").value).toBe("Problems");
    expect(sheet.getCell("A2").value).toBe("Price missing");
    expect(argb(sheet.getCell("C2"))).toBe(MARK_ARGB);
    expect(sheet.getCell("B3").value).toBe("Shawl");
    const before = (await parseSheet(csv, "list.csv")).rows.map((row) => row.cells);
    const after = (await parseSheet(marked, "list.xlsx")).rows.map(({ cells: { problems: _p, ...cells } }) => cells);
    expect(after.map((cells) => cells.name)).toEqual(before.map((cells) => cells.name));
  });
});

describe("the row schema names a blank price the way the returned file does (A4)", () => {
  it("says 'Price missing' and still hands back the row's draft to check its words", () => {
    const parsed = parseBulkProductRow({
      rowNumber: 7,
      cells: { name: "Emerald Abaya", description: "d", category: "abayas", weight: "1", images: "a.jpg", colour: "Emrald" },
    });
    if (!("errors" in parsed)) throw new Error("a blank price must not parse");
    expect(parsed.errors).toEqual([{ row: 7, field: "price", message: "Price missing" }]);
    expect(parsed.draft.factLabels).toEqual({ colour: "Emrald" });
  });
});

describe("markedFileName", () => {
  it("keeps the shop's name for its file, header-safe", () => {
    expect(markedFileName("Noor stock — Oct.xlsx")).toBe("Noor-stock-Oct-problems-marked.xlsx");
    expect(markedFileName("list.csv")).toBe("list-problems-marked.xlsx");
  });
});
