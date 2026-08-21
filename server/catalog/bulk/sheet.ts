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

export interface RawSheetRow {
  /** 1-based row number as the user sees it in Excel. */
  rowNumber: number;
  cells: Record<string, string>;
}

export interface RawSheet {
  headers: string[];
  rows: RawSheetRow[];
}

/** exceljs cell values can be rich objects; a sheet cell is a string to us. */
function cellText(value: ExcelJS.CellValue): string {
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

  const worksheet = workbook.worksheets[0];
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
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = headers[col];
      if (header) cells[header] = cellText(cell.value);
    });
    if (Object.values(cells).some((v) => v !== "")) rows.push({ rowNumber, cells });
  });

  return { headers: headers.filter(Boolean), rows };
}
