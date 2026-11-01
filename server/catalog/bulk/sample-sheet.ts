/**
 * The workbook a shop downloads, built at the moment it is asked for
 * ([own-store/bulk-sheet](../../../docs/specs/own-store/bulk-sheet/trd.md) D1, D2).
 *
 * Instructions first, then one tab per type the shop ticked. Every column, dropdown and stock
 * column is read now, so adding a type or a colour changes the next sheet with no file to edit.
 */
import ExcelJS from "exceljs";

import { indiaDate } from "@server/shared/india-time";

import { SHEET_LIST, tabColumns, VIDEO_HELP, type SheetColumn } from "./sheet-columns";
import { LISTS_TAB, type SheetTab } from "./sheet-tabs";
import { sheetFingerprint, shortVersion, STAMP_KEY, type SheetPlan, type StampedTab } from "./sheet-stamp";
import { NO, YES } from "./word-match";

export interface SampleSheetContext {
  orgName: string;
  madeOn: Date;
  locationNames: string[];
  tabs: SheetTab[];
  /** The permitted answers, by list, for whatever the tabs' types ask about. */
  values: Record<string, Array<{ key: string; label: string }>>;
  /** Category slug → "Women › Abayas", what the category dropdown shows (Q6). A slug without one shows itself. */
  categoryPaths?: Record<string, string>;
  /** The shop's families by name; the dropdown suggests them and allows a new one (Q7). */
  families?: string[];
  /** The shop's live brands by name; none means no Brand column. */
  brands?: string[];
  /** The ticks the sheet is made for, stamped so an upload is compared with today's sheet for them (D4). */
  categoryIds?: string[];
}

/** Excel's own stop on a typed value outside a stopping list (ux.md, Refused). */
export const LIST_STOP = "Pick from the list in this column.";
/** A new family is legitimate, so Excel only warns (Q7). */
export const FAMILY_WARNING = "Not in the list — a new family is created with this name.";

/** The example row's first data cell; the upload skips a row while it still says this (Q9). */
export const EXAMPLE_MARKER = "EXAMPLE — this row is skipped";
/** Column A of every tab, and the key the upload recognises a tab by (D2). */
export const PROBLEMS_HEADING = "Problems";
export const PROBLEMS_KEY = "problems";
export const INSTRUCTIONS_TAB = "Instructions";
export const LISTS_GUIDE = "Lists guide";
export const HEADING_ROW = 1;
export const KEY_ROW = 2;
export const HELP_ROW = 3;
export const EXAMPLE_ROW = 4;

const LAST_ROW = 500;
const REQUIRED_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6B26B" } };
const EXAMPLE_FONT: Partial<ExcelJS.Font> = { italic: true, color: { argb: "FF808080" } };

export async function buildProductSampleSheet(ctx: SampleSheetContext): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const { fingerprint } = sheetPlan(ctx);
  writeInstructions(workbook.addWorksheet(INSTRUCTIONS_TAB), ctx, shortVersion(fingerprint));
  const tabs = ctx.tabs.map((tab) => ({ tab, sheet: workbook.addWorksheet(tab.name) }));
  const lookups = workbook.addWorksheet(LISTS_TAB);
  lookups.state = "veryHidden";
  const lists = sheetLists(ctx);
  const ranges = writeLookups(lookups, lists);
  writeStamp(lookups, lists.length + 1, ctx, fingerprint);
  for (const { tab, sheet } of tabs) writeTab(sheet, tab, ctx, ranges);
  writeListsGuide(workbook.getWorksheet(INSTRUCTIONS_TAB)!, lists);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** The columns and lists a sheet for these choices has, fingerprinted (D4) — what an upload is judged against. */
export function sheetPlan(ctx: SampleSheetContext): SheetPlan {
  const tabs: StampedTab[] = ctx.tabs.map((tab) => ({
    name: tab.name,
    columns: tabColumns(tab.type, ctx.locationNames, { brands: !!ctx.brands?.length }),
  }));
  return { fingerprint: sheetFingerprint(tabs, sheetLists(ctx)), tabs };
}

/** Down one column of the hidden Lists tab, after the lists: key, made-on, fingerprint, ticks. */
function writeStamp(sheet: ExcelJS.Worksheet, column: number, ctx: SampleSheetContext, fingerprint: string) {
  [STAMP_KEY, ctx.madeOn.toISOString(), fingerprint, (ctx.categoryIds ?? []).join(",")].forEach(
    (value, index) => (sheet.getCell(index + 1, column).value = value),
  );
}

function writeTab(
  sheet: ExcelJS.Worksheet,
  tab: SheetTab,
  ctx: SampleSheetContext,
  ranges: Record<string, string>,
) {
  const columns = tabColumns(tab.type, ctx.locationNames, { brands: !!ctx.brands?.length });
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
    const formula = column.list ? ranges[listName(column.list, tab)] : undefined;
    if (!formula) return;
    // Family takes a new name, so Excel warns; every other list is the platform's, so it stops (Q7).
    const family = column.list === SHEET_LIST.FAMILY;
    const validation: ExcelJS.DataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formula],
      showErrorMessage: true,
      errorStyle: family ? "warning" : "stop",
      error: family ? FAMILY_WARNING : LIST_STOP,
    };
    for (let row = EXAMPLE_ROW + 1; row <= LAST_ROW; row += 1) {
      sheet.getCell(row, index + 2).dataValidation = validation;
    }
  });
}

/** Category and kind differ per tab — each tab offers only its own (D1); every other list is shared. */
function listName(list: string, tab: SheetTab): string {
  return list === SHEET_LIST.CATEGORY || list === SHEET_LIST.KIND ? `${list}:${tab.name}` : list;
}

/** A tab's categories as the dropdown shows them: paths, in order (Q6). */
const tabPaths = (ctx: SampleSheetContext, tab: SheetTab) =>
  tab.categorySlugs.map((slug) => ctx.categoryPaths?.[slug] ?? slug).sort((a, b) => a.localeCompare(b));

/** Every list the tabs draw on, in words (D3): named for the hidden tab, titled for the guide. */
function sheetLists(ctx: SampleSheetContext): Array<{ name: string; title: string; words: string[] }> {
  const lists: Array<{ name: string; title: string; words: string[] }> = [];
  for (const tab of ctx.tabs) {
    const kinds = tab.type?.kinds.map((kind) => kind.label) ?? [];
    lists.push({ name: listName(SHEET_LIST.CATEGORY, tab), title: `Category on ${tab.name}`, words: tabPaths(ctx, tab) });
    lists.push({ name: listName(SHEET_LIST.KIND, tab), title: `Kind on ${tab.name}`, words: kinds });
  }
  lists.push({ name: SHEET_LIST.FAMILY, title: "Family", words: ctx.families ?? [] });
  lists.push({ name: SHEET_LIST.BRAND, title: "Brand", words: ctx.brands ?? [] });
  lists.push({ name: SHEET_LIST.YES_NO, title: "Yes or no", words: [YES, NO] });
  for (const [list, options] of Object.entries(ctx.values)) {
    lists.push({ name: list, title: listTitle(list, ctx), words: options.map((option) => option.label) });
  }
  return lists.filter((list) => list.words.length > 0);
}

/** A fact list is titled by the word its column uses, "Fabric" rather than "material". */
function listTitle(list: string, ctx: SampleSheetContext): string {
  for (const tab of ctx.tabs) {
    const column = tabColumns(tab.type, []).find((c) => c.list === list);
    if (column) return column.heading;
  }
  return list;
}

/** Each list down one column of the hidden tab, so a dropdown points at a range and any word fits. */
function writeLookups(
  sheet: ExcelJS.Worksheet,
  lists: ReturnType<typeof sheetLists>,
): Record<string, string> {
  const ranges: Record<string, string> = {};
  lists.forEach((list, index) => {
    const column = index + 1;
    sheet.getCell(1, column).value = list.name;
    list.words.forEach((word, row) => (sheet.getCell(row + 2, column).value = word));
    const letter = sheet.getColumn(column).letter;
    ranges[list.name] = `${LISTS_TAB}!$${letter}$2:$${letter}$${list.words.length + 1}`;
  });
  return ranges;
}

/** The same lists, visible, for a phone app that shows no dropdowns (ux.md, Terminal error). */
function writeListsGuide(sheet: ExcelJS.Worksheet, lists: ReturnType<typeof sheetLists>) {
  sheet.addRow([""]);
  sheet.addRow([LISTS_GUIDE]).font = { bold: true };
  sheet.addRow(["Copy a value exactly as written here."]);
  for (const list of lists) {
    const row = sheet.addRow([`${list.title}: ${list.words.join(" · ")}`]);
    row.alignment = { wrapText: true, vertical: "top" };
  }
}

/** Deliberately not plausible, so an example that slips through collides with nothing real. */
function exampleCell(column: SheetColumn, tab: SheetTab, ctx: SampleSheetContext): string | number {
  switch (column.key) {
    case "name": return EXAMPLE_MARKER;
    case "kind": return tab.type?.kinds[0]?.label ?? "";
    case "description": return "Replace this row with your own product.";
    case "price": return 2499;
    case "category": return tabPaths(ctx, tab)[0] ?? "";
    case "brand": return ctx.brands?.[0] ?? "";
    case "sku": return "EXAMPLE-SKU-1";
    case "weight": return 0.6;
    case "tags": return "example;replace-me";
    case "images": return "example-product/front.jpg;example-product/back.jpg";
    default:
      if (column.key.startsWith("stock:")) return 12;
      if (column.list === SHEET_LIST.YES_NO) return YES;
      if (column.list) return ctx.values[column.list]?.[0]?.label ?? "";
      return "";
  }
}

function writeInstructions(sheet: ExcelJS.Worksheet, ctx: SampleSheetContext, version: string) {
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
    [`Made ${indiaDate(ctx.madeOn)} · version ${version}. Download a fresh sheet each time — our lists change.`],
  );
  for (const [text, font] of lines) {
    const row = sheet.addRow([text]);
    if (font) row.font = font;
  }
  sheet.getColumn(1).width = 100;
}
