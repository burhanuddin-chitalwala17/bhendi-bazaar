/**
 * Spreadsheet → raw string cells (bulk-catalog-upload D1/D2).
 *
 * Nothing here is trusted or typed: the output is exactly what the sheet said,
 * keyed by lower-cased header, for the Zod row schema to parse. exceljs over the
 * npm SheetJS build because the latter is abandoned with unfixed parser CVEs and
 * this parses hostile files (see the spec folder's sheet-parsing-options.md).
 */
import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { DomainError } from "@server/shared/domain-error";
import { EXAMPLE_MARKER, EXAMPLE_ROW, HEADING_ROW, INSTRUCTIONS_TAB, KEY_ROW, PROBLEMS_KEY } from "./sample-sheet";
import { STAMP_KEY, type SheetStamp, type StampedTab } from "./sheet-stamp";
import { LISTS_TAB } from "./sheet-tabs";

export interface RawSheetRow {
  /** 1-based row number as the user sees it in Excel. */
  rowNumber: number;
  /** The tab the row is on; two tabs share row numbers, so a row is named by both. */
  tab?: string;
  cells: Record<string, string>;
  /** Where each cell sits, "D5", by the same key — what marks a problem in the shop's own file (D5, D7). */
  addresses?: Record<string, string>;
}

export interface RawSheet {
  headers: string[];
  rows: RawSheetRow[];
  /** The .xlsx's own creation date, which dates a sheet carrying no stamp (Q28); null for a .csv. */
  createdOn: Date | null;
  csv: boolean;
  /** What the Lists tab says the sheet was made from (D4); null for a .csv or a sheet from before the stamp. */
  stamp: SheetStamp | null;
  /** Each keyed tab's columns as uploaded — keys lower-cased, headings as the person left them. */
  tabs?: StampedTab[];
}

/** exceljs cell values can be rich objects; a sheet cell is a string to us. */
export function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text).join("").trim();
    }
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim();
}

export async function parseSheet(buffer: Buffer, filename: string): Promise<RawSheet> {
  const workbook = new ExcelJS.Workbook();
  const isCsv = filename.toLowerCase().endsWith(".csv");
  try {
    if (isCsv) {
      await workbook.csv.read(Readable.from(buffer));
    } else {
      await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    }
  } catch (cause) {
    throw new DomainError(
      "Could not read the sheet — save it as .xlsx or .csv and try again.",
      { cause }
    );
  }

  const createdOn = isCsv ? null : (workbook.created ?? null);
  const stamp = isCsv ? null : readStamp(workbook);
  const tabs = workbook.worksheets.filter(isKeyedTab);
  if (tabs.length > 0) return { ...readKeyedTabs(tabs), createdOn, csv: isCsv, stamp };

  // Instructions is never product rows, even when no tab is recognised as keyed.
  const worksheet = workbook.worksheets.find((sheet) => sheet.name !== INSTRUCTIONS_TAB);
  if (!worksheet) throw new DomainError("The file contains no sheet.");

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = cellText(cell.value).toLowerCase();
  });
  if (headers.filter(Boolean).length === 0) {
    throw new DomainError("The first row must be the column headers — see the sample sheet.");
  }

  const rows: RawSheetRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const cells: Record<string, string> = {};
    const addresses: Record<string, string> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = headers[col];
      if (header) {
        cells[header] = cellText(cell.value);
        addresses[header] = cell.address;
      }
    });
    if (Object.values(cells).some((v) => v !== "")) rows.push({ rowNumber, cells, addresses });
  });

  return { headers: headers.filter(Boolean), rows, createdOn, csv: isCsv, stamp };
}

/** The stamp column of the hidden Lists tab (D4). Anything unreadable there is no stamp, never a failure. */
function readStamp(workbook: ExcelJS.Workbook): SheetStamp | null {
  const lists = workbook.getWorksheet(LISTS_TAB);
  if (!lists) return null;
  let column = 0;
  lists.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    if (cellText(cell.value) === STAMP_KEY) column = col;
  });
  if (!column) return null;
  const madeOn = new Date(cellText(lists.getCell(2, column).value));
  const fingerprint = cellText(lists.getCell(3, column).value);
  if (Number.isNaN(madeOn.getTime()) || !/^[0-9a-f]{64}$/.test(fingerprint)) return null;
  const categoryIds = cellText(lists.getCell(4, column).value).split(",").filter(Boolean);
  return { madeOn, fingerprint, categoryIds };
}

/**
 * A tab of the downloaded workbook: visible, with the hidden key row under its headings (D2).
 * Known by its keys anywhere in that row, so deleting the Problems column does not unrecognise it.
 */
export function isKeyedTab(sheet: ExcelJS.Worksheet): boolean {
  if (sheet.state !== "visible") return false;
  const keys = new Set<string>();
  sheet.getRow(KEY_ROW).eachCell({ includeEmpty: false }, (cell) => {
    keys.add(cellText(cell.value).toLowerCase());
  });
  return KEYED_TAB_MARKS.every((key) => keys.has(key));
}

const KEYED_TAB_MARKS = ["name", "price"];

/**
 * Every type tab, read by its key row so a renamed heading breaks nothing (Q5). The help line
 * is skipped, as is the example while its marker stays (A5), and Problems is never read.
 */
function readKeyedTabs(tabs: ExcelJS.Worksheet[]): Pick<RawSheet, "headers" | "rows" | "tabs"> {
  const headers = new Set<string>();
  const rows: RawSheetRow[] = [];
  const read: StampedTab[] = [];
  for (const sheet of tabs) {
    const keys: string[] = [];
    const columns: StampedTab["columns"] = [];
    sheet.getRow(KEY_ROW).eachCell({ includeEmpty: false }, (cell, col) => {
      const key = cellText(cell.value).toLowerCase();
      if (!key || key === PROBLEMS_KEY) return;
      keys[col] = key;
      columns.push({ key, heading: cellText(sheet.getCell(HEADING_ROW, col).value) });
    });
    read.push({ name: sheet.name, columns });
    keys.forEach((key) => key && headers.add(key));
    const firstColumn = keys.findIndex(Boolean);
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber < EXAMPLE_ROW) return;
      if (cellText(row.getCell(firstColumn).value) === EXAMPLE_MARKER) return;
      const cells: Record<string, string> = {};
      const addresses: Record<string, string> = {};
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (!keys[col]) return;
        cells[keys[col]] = cellText(cell.value);
        addresses[keys[col]] = cell.address;
      });
      if (Object.values(cells).some((v) => v !== "")) rows.push({ rowNumber, tab: sheet.name, cells, addresses });
    });
  }
  if (rows.length === 0) {
    throw new DomainError("Your sheet has no products yet — the example row is skipped.");
  }
  return { headers: [...headers], rows, tabs: read };
}
