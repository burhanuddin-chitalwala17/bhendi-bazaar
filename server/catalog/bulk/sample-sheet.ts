/**
 * The workbook a shop downloads, built at the moment it is asked for
 * ([own-store/bulk-sheet](../../../docs/specs/own-store/bulk-sheet/trd.md) D1, D2).
 *
 * Instructions first, then one tab per type the shop ticked. Every column, dropdown and stock
 * column is read now, so adding a type or a colour changes the next sheet with no file to edit.
 */
import ExcelJS from "exceljs";

import { indiaDate } from "@server/shared/india-time";

import { tabColumns, VIDEO_HELP, type SheetColumn } from "./sheet-columns";
import type { SheetTab } from "./sheet-tabs";

export interface SampleSheetContext {
  orgName: string;
  madeOn: Date;
  locationNames: string[];
  tabs: SheetTab[];
  /** The permitted answers, by list, for whatever the tabs' types ask about. */
  values: Record<string, Array<{ key: string; label: string }>>;
}

/** The example row's first data cell; the upload skips a row while it still says this (Q9). */
export const EXAMPLE_MARKER = "EXAMPLE — this row is skipped";
/** Column A of every tab, and the key the upload recognises a tab by (D2). */
export const PROBLEMS_HEADING = "Problems";
export const PROBLEMS_KEY = "problems";
export const INSTRUCTIONS_TAB = "Instructions";
export const HEADING_ROW = 1;
export const KEY_ROW = 2;
export const HELP_ROW = 3;
export const EXAMPLE_ROW = 4;

const LAST_ROW = 500;
/** Excel refuses an inline list much past this, so a longer one is referenced from a hidden tab. */
const MAX_INLINE_DROPDOWN = 255;
const REQUIRED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6B26B" } };
const EXAMPLE_FONT: Partial<ExcelJS.Font> = { italic: true, color: { argb: "FF808080" } };

export async function buildProductSampleSheet(ctx: SampleSheetContext): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  writeInstructions(workbook.addWorksheet(INSTRUCTIONS_TAB), ctx);
  const tabs = ctx.tabs.map((tab) => ({ tab, sheet: workbook.addWorksheet(tab.name) }));
  const lookups = workbook.addWorksheet("Answers");
  lookups.state = "veryHidden";
  const ranges = writeLookups(lookups, ctx);
  for (const { tab, sheet } of tabs) writeTab(sheet, tab, ctx, ranges);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function writeTab(
  sheet: ExcelJS.Worksheet,
  tab: SheetTab,
  ctx: SampleSheetContext,
  ranges: Record<string, string>,
) {
  const columns = tabColumns(tab.type, ctx.locationNames);
  sheet.getRow(HEADING_ROW).values = [PROBLEMS_HEADING, ...columns.map((c) => c.heading)];
  sheet.getRow(KEY_ROW).values = [PROBLEMS_KEY, ...columns.map((c) => c.key)];
  sheet.getRow(KEY_ROW).hidden = true;
  sheet.getRow(HELP_ROW).values = ["Left empty — problems show here", ...columns.map((c) => c.help)];
  sheet.getRow(HEADING_ROW).font = { bold: true };
  sheet.getRow(HELP_ROW).alignment = { wrapText: true, vertical: "top" };
  sheet.getRow(HELP_ROW).font = { size: 9 };
  columns.forEach((column, index) => {
    if (column.required) sheet.getCell(HEADING_ROW, index + 2).fill = REQUIRED_FILL;
    sheet.getColumn(index + 2).width = Math.max(14, column.heading.length + 4);
  });
  sheet.getColumn(1).width = 24;

  // The example goes in before the dropdowns: they materialise rows, and nothing may push it down.
  sheet.getRow(EXAMPLE_ROW).values = [null, ...columns.map((column) => exampleCell(column, tab, ctx))];
  sheet.getRow(EXAMPLE_ROW).font = EXAMPLE_FONT;
  sheet.views = [{ state: "frozen", xSplit: 1, ySplit: HELP_ROW }];

  columns.forEach((column, index) => {
    const formula = dropdownFor(column, tab, ctx.values, ranges);
    if (!formula) return;
    for (let row = EXAMPLE_ROW + 1; row <= LAST_ROW; row += 1) {
      sheet.getCell(row, index + 2).dataValidation = { type: "list", allowBlank: true, formulae: [formula] };
    }
  });
}

/** Category offers this tab's ticked categories (D1); a fact offers its list. Blank is always allowed. */
function dropdownFor(
  column: SheetColumn,
  tab: SheetTab,
  values: SampleSheetContext["values"],
  ranges: Record<string, string>,
): string | undefined {
  if (column.key === "category") return inlineList(tab.categorySlugs) ?? ranges[`category:${tab.name}`];
  if (!column.list || !values[column.list]?.length) return undefined;
  return ranges[column.list];
}

function inlineList(options: string[]): string | undefined {
  const formula = `"${options.join(",")}"`;
  return options.length && formula.length <= MAX_INLINE_DROPDOWN ? formula : undefined;
}

/** Each list down one column of the hidden tab, so a dropdown can point at a range. */
function writeLookups(sheet: ExcelJS.Worksheet, ctx: SampleSheetContext): Record<string, string> {
  const ranges: Record<string, string> = {};
  let column = 1;
  const write = (name: string, labels: string[]) => {
    sheet.getCell(1, column).value = name;
    labels.forEach((label, index) => (sheet.getCell(index + 2, column).value = label));
    const letter = sheet.getColumn(column).letter;
    ranges[name] = `Answers!$${letter}$2:$${letter}$${labels.length + 1}`;
    column += 1;
  };
  for (const [list, options] of Object.entries(ctx.values)) {
    if (options.length) write(list, options.map((option) => option.label));
  }
  for (const tab of ctx.tabs) {
    if (tab.categorySlugs.length && !inlineList(tab.categorySlugs)) write(`category:${tab.name}`, tab.categorySlugs);
  }
  return ranges;
}

/** Deliberately not plausible, so an example that slips through collides with nothing real. */
function exampleCell(column: SheetColumn, tab: SheetTab, ctx: SampleSheetContext): string | number {
  switch (column.key) {
    case "name": return EXAMPLE_MARKER;
    case "kind": return tab.type?.kinds[0]?.key ?? "";
    case "description": return "Replace this row with your own product.";
    case "price": return 2499;
    case "category": return tab.categorySlugs[0] ?? "";
    case "sku": return "EXAMPLE-SKU-1";
    case "weight": return 0.6;
    case "tags": return "example;replace-me";
    case "images": return "example-product/front.jpg;example-product/back.jpg";
    default:
      if (column.key.startsWith("stock:")) return 12;
      if (column.list) return ctx.values[column.list]?.[0]?.label ?? "";
      return "";
  }
}

function writeInstructions(sheet: ExcelJS.Worksheet, ctx: SampleSheetContext) {
  const lines: Array<[string, Partial<ExcelJS.Font>?]> = [
    ["How to fill this sheet", { bold: true, size: 14 }],
    [`For ${ctx.orgName}. Tabs: ${ctx.tabs.map((tab) => tab.name).join(", ")}.`],
    [""],
    ["1. Fill one tab for each kind of thing. Start on row 5; row 4 is an example and is skipped."],
    ["2. Use the ▼ lists — type only names, prices and numbers."],
    ["3. Photos: write the folder and file, e.g. emerald-abaya/front.jpg"],
    [`   Video: a ${VIDEO_HELP}`],
    ["4. Save as .xlsx."],
    ["5. Upload the sheet with your photos on the Add many at once page."],
    [""],
    ["Orange heading = must fill", { bold: true }],
  ];
  if (ctx.locationNames.length === 0) {
    lines.push(["Your shop has no pickup address yet, so this sheet has no stock columns. Add one, then download again."]);
  }
  lines.push(
    [""],
    [`Made ${indiaDate(ctx.madeOn)}. Download a fresh sheet each time — our lists change.`],
  );
  for (const [text, font] of lines) {
    const row = sheet.addRow([text]);
    if (font) row.font = font;
  }
  sheet.getColumn(1).width = 100;
}
