import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { buildProductSampleSheet, sheetPlan, type SampleSheetContext } from "@server/catalog/bulk/sample-sheet";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { judgeSheet, STAMP_KEY } from "@server/catalog/bulk/sheet-stamp";
import { SHEET_AGE_COPY } from "@server/catalog/bulk/sheet-copy";
import { planSheetTabs } from "@server/catalog/bulk/sheet-tabs";
import { nameColumns } from "@server/catalog/bulk/row-errors";
import { CHECK_COPY, groupByRow, rowsWithProblems } from "@/components/bulk-upload/check-copy";
import { MEASURE, UNIT } from "@server/listing/listing-facts";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * own-store/bulk-sheet U3: every file carries its date and a version; an older sheet that still
 * reads is warned and accepted, one whose columns no longer read is refused naming the column
 * (R4, A3, D4); problems are named by tab and column and the check counts creates and updates
 * (R7, R8, D8).
 */
const abaya: ProductTypeRecord = {
  key: "abaya",
  label: "Abaya",
  facts: ["colour", "material"],
  factLabels: { material: "Fabric" },
  measures: [],
  variantAxis: [],
  kinds: [],
  labelFrom: [],
  labelScale: null,
};

const categories = [{ id: "abayas", parentId: null, slug: "abayas", name: "Abayas", productType: "abaya" }];

function context(type: ProductTypeRecord = abaya, colours = ["Emerald", "Black"]): SampleSheetContext {
  return {
    orgName: "Noor",
    madeOn: new Date("2026-10-12T06:00:00Z"),
    locationNames: ["Shop"],
    tabs: planSheetTabs(["abayas"], categories, [type]),
    values: {
      colour: colours.map((label) => ({ key: label.toLowerCase(), label })),
      material: [{ key: "nida", label: "Nida" }],
    },
    categoryPaths: { abayas: "Abayas" },
    categoryIds: ["abayas"],
  };
}

async function filled(ctx: SampleSheetContext, edit?: (book: ExcelJS.Workbook) => void) {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load((await buildProductSampleSheet(ctx)) as unknown as ArrayBuffer);
  const tab = book.getWorksheet("Abaya")!;
  const keys = (tab.getRow(2).values as unknown[]).map((v) => String(v ?? ""));
  tab.getCell(5, keys.indexOf("name")).value = "Emerald abaya";
  tab.getCell(5, keys.indexOf("price")).value = 2499;
  edit?.(book);
  return parseSheet(Buffer.from(await book.xlsx.writeBuffer()), "sheet.xlsx");
}

describe("A3 — the stamp", () => {
  it("carries the made-on date, the fingerprint and the ticks on the Lists tab", async () => {
    const ctx = context();
    const raw = await filled(ctx);
    expect(raw.stamp).toEqual({ madeOn: ctx.madeOn, fingerprint: sheetPlan(ctx).fingerprint, categoryIds: ["abayas"] });
  });

  it("shows the date and the six-character version on Instructions (Q27)", async () => {
    const ctx = context();
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await buildProductSampleSheet(ctx)) as unknown as ArrayBuffer);
    const text: string[] = [];
    book.getWorksheet("Instructions")!.eachRow((row) => text.push(String(row.getCell(1).value ?? "")));
    const version = sheetPlan(ctx).fingerprint.slice(0, 6);
    expect(text).toContain(`Made 12 Oct 2026 · version ${version}. Download a fresh sheet each time — our lists change.`);
  });

  it("is the same for the same choices and moves when a list gains a word", () => {
    expect(sheetPlan(context()).fingerprint).toBe(sheetPlan(context()).fingerprint);
    expect(sheetPlan(context(abaya, ["Emerald", "Black", "Teal"])).fingerprint).not.toBe(sheetPlan(context()).fingerprint);
  });
});

describe("A3 — an upload judged against today's sheet", () => {
  it("is silent when nothing changed, even with a heading renamed by the shop (Q5)", async () => {
    const raw = await filled(context(), (book) => {
      book.getWorksheet("Abaya")!.getCell("B1").value = "What it is called";
    });
    expect(judgeSheet(raw, sheetPlan(context()))).toEqual({
      madeOn: "2026-10-12T06:00:00.000Z",
      version: sheetPlan(context()).fingerprint.slice(0, 6),
      stale: false,
      refusedColumn: null,
    });
  });

  it("warns and accepts a sheet from before a colour was added", async () => {
    const age = judgeSheet(await filled(context()), sheetPlan(context(abaya, ["Emerald", "Black", "Teal"])));
    expect(age).toMatchObject({ madeOn: "2026-10-12T06:00:00.000Z", stale: true, refusedColumn: null });
  });

  it("refuses a sheet whose column no longer reads, naming it as the file heads it", async () => {
    const today = { ...abaya, facts: ["material"] } as ProductTypeRecord;
    const age = judgeSheet(await filled(context()), sheetPlan(context(today)));
    expect(age.refusedColumn).toBe("Colour");
    expect(SHEET_AGE_COPY.tooOld(age.refusedColumn!)).toBe("This sheet is too old to read: the 'Colour' column has changed.");
  });

  it("refuses a sheet missing a column today's sheet requires", async () => {
    const today: ProductTypeRecord = {
      ...abaya,
      measures: [{ key: MEASURE.LENGTH, label: "Length", unit: UNIT.INCH, required: true }],
    };
    expect(judgeSheet(await filled(context()), sheetPlan(context(today))).refusedColumn).toBe("Length (in)");
  });

  it("does not refuse for a column today's sheet only offers", async () => {
    const today: ProductTypeRecord = {
      ...abaya,
      measures: [{ key: MEASURE.LENGTH, label: "Length", unit: UNIT.INCH, required: false }],
    };
    expect(judgeSheet(await filled(context()), sheetPlan(context(today)))).toMatchObject({ stale: true, refusedColumn: null });
  });

  it("warns an unstamped .xlsx with its own creation date and reads a .csv as today (Q28)", async () => {
    const raw = await filled(context(), (book) => {
      const lists = book.getWorksheet("Lists")!;
      lists.getRow(1).eachCell((cell) => {
        if (cell.value === STAMP_KEY) cell.value = null;
      });
      book.created = new Date("2026-09-12T08:00:00Z");
    });
    expect(raw.stamp).toBeNull();
    expect(judgeSheet(raw, null)).toEqual({ madeOn: "2026-09-12T08:00:00.000Z", version: null, stale: true, refusedColumn: null });

    const csv = await parseSheet(Buffer.from("name,price\nRose attar,499\n"), "old.csv");
    expect(judgeSheet(csv, null)).toEqual({ madeOn: null, version: null, stale: false, refusedColumn: null });
  });

  it("says the stale and refused lines in the copy deck's words", () => {
    expect(SHEET_AGE_COPY.stale("12 Oct")).toBe("This sheet is from 12 Oct. Our lists changed since — new rows may miss new choices.");
    expect(SHEET_AGE_COPY.continue).toBe("Continue with this sheet");
    expect(SHEET_AGE_COPY.fresh).toBe("Download a fresh sheet");
  });
});

describe("R7, R8 — problems by tab and column, counts", () => {
  it("names a problem's column by the heading in the shop's own file", async () => {
    const raw = await filled(context(), (book) => {
      book.getWorksheet("Abaya")!.getCell("B1").value = "Item";
    });
    const named = nameColumns(
      [
        { row: 5, tab: "Abaya", field: "name", message: "Name must be at least 2 characters" },
        { row: 5, tab: "Abaya", field: "categorySlug", message: "Category is required" },
        { row: 0, field: "sheet", message: "too many" },
      ],
      raw,
    );
    expect(named.map((error) => error.column)).toEqual(["Item", "Category", undefined]);
  });

  it("names a .csv's columns in today's sheet's words", () => {
    expect(nameColumns([{ row: 2, field: "price", message: "x" }], {}).map((e) => e.column)).toEqual(["Price (₹)"]);
  });

  it("names a product-type problem by the Category column it is read from, never the field", () => {
    expect(nameColumns([{ row: 2, field: "productType", message: "x" }], {}).map((e) => e.column)).toEqual(["Category"]);
  });

  it("counts no row for a problem with the file itself, so an over-300 sheet is not '1 problem in 1 row'", () => {
    const sheetOnly = [{ row: 0, field: "sheet", message: "Your sheet has 412 rows." }];
    expect(rowsWithProblems(sheetOnly)).toBe(0);
    expect(CHECK_COPY.problems(1, rowsWithProblems(sheetOnly))).toBe("1 problem · nothing created yet");
    expect(rowsWithProblems([...sheetOnly, { row: 4, field: "price", message: "x" }])).toBe(1);
  });

  it("groups by row and tab, so row 5 on two tabs is two rows", () => {
    const groups = groupByRow([
      { row: 5, tab: "Abaya", field: "price", message: "a" },
      { row: 5, tab: "Abaya", field: "colour", message: "b" },
      { row: 5, tab: "Attar", field: "price", message: "c" },
      { row: 7, tab: "Attar", field: "price", message: "d" },
    ]);
    expect(groups.map((g) => [g.label, g.problems.length])).toEqual([
      ["Row 5 · Abaya", 2],
      ["Row 5 · Attar", 1],
      ["Row 7 · Attar", 1],
    ]);
    expect(CHECK_COPY.problems(6, 4)).toBe("6 problems in 4 rows · nothing created yet");
  });

  it("counts creates and updates in the check's and the done screen's words", () => {
    expect(CHECK_COPY.clean(40, 32, 8)).toBe("All 40 rows look good · 32 new, 8 updates");
    expect(CHECK_COPY.createAction(32, 8)).toBe("Create 32 · update 8");
    expect(CHECK_COPY.createAction(40, 0)).toBe("Create 40");
    expect(CHECK_COPY.createAction(0, 3)).toBe("Update 3");
    expect(CHECK_COPY.done(40, 32, 8)).toBe("40 products on sale · 32 new, 8 updated");
  });
});
