/**
 * The shop's own file with its problems marked (own-store/bulk-sheet D7, Q11, Q12, Q30): each bad
 * cell filled red with a note, each bad row's Problems cell filled and written. Nothing else is
 * written, so the same file uploads again once fixed — Problems is never read, and fills are formatting.
 */
import ExcelJS from "exceljs";
import { Readable } from "node:stream";

import type { RowError } from "./bulk.types";
import { columnKeyOf } from "./row-errors";
import { EXAMPLE_ROW, HEADING_ROW, INSTRUCTIONS_TAB, KEY_ROW, PROBLEMS_HEADING, PROBLEMS_KEY } from "./sample-sheet";
import { cellText, isKeyedTab } from "./sheet";

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Excel's own "Bad" red, so a red cell is cleared only when its note is ours (`clearMarks`). */
export const MARK_ARGB = "FFFFC7CE";
const MARK_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: MARK_ARGB } };
/** Between two problems in one Problems cell (ux.md, The returned workbook). */
export const PROBLEM_SEPARATOR = " · ";

interface Target {
  sheet: ExcelJS.Worksheet;
  /** Column key → column number. */
  columns: Map<string, number>;
  problems: number;
  firstRow: number;
}

export async function markProblems(buffer: Buffer, filename: string, errors: readonly RowError[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const csv = filename.toLowerCase().endsWith(".csv");
  if (csv) await workbook.csv.read(Readable.from(buffer));
  else await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const keyed = workbook.worksheets.filter(isKeyedTab);
  const plain = workbook.worksheets.find((sheet) => sheet.name !== INSTRUCTIONS_TAB);
  const targets = keyed.length ? keyed.map(keyedTarget) : plain ? [plainTarget(plain, csv)] : [];
  targets.forEach(clearMarks);

  const byRow = new Map<string, { target: Target; row: number; errors: RowError[] }>();
  for (const error of errors) {
    if (error.row === 0) continue;
    const target = keyed.length ? targets.find((t) => t.sheet.name === error.tab) : targets[0];
    if (!target) continue;
    const id = `${target.sheet.name}|${error.row}`;
    const entry = byRow.get(id) ?? { target, row: error.row, errors: [] };
    entry.errors.push(error);
    byRow.set(id, entry);
  }

  for (const { target, row, errors: rowErrors } of byRow.values()) {
    for (const error of rowErrors) {
      const column = target.columns.get(columnKeyOf(error.field));
      if (!column) continue;
      const cell = target.sheet.getCell(row, column);
      const earlier = noteText(cell);
      paint(cell);
      cell.note = earlier ? `${earlier}\n${error.message}` : error.message;
    }
    const problems = target.sheet.getCell(row, target.problems);
    problems.value = rowErrors.map((error) => error.message).join(PROBLEM_SEPARATOR);
    paint(problems);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function keyedTarget(sheet: ExcelJS.Worksheet): Target {
  const columns = new Map<string, number>();
  sheet.getRow(KEY_ROW).eachCell({ includeEmpty: false }, (cell, col) => {
    columns.set(cellText(cell.value).toLowerCase(), col);
  });
  let problems = columns.get(PROBLEMS_KEY);
  if (!problems) {
    // Column A was deleted: the file is never shifted (D2), so Problems goes after the last column.
    problems = Math.max(0, ...columns.values()) + 1;
    sheet.getCell(HEADING_ROW, problems).value = PROBLEMS_HEADING;
    sheet.getCell(KEY_ROW, problems).value = PROBLEMS_KEY;
  }
  return { sheet, columns, problems, firstRow: EXAMPLE_ROW };
}

/** A .csv or an .xlsx from before key rows: columns by heading text, as the upload reads them. */
function plainTarget(sheet: ExcelJS.Worksheet, csv: boolean): Target {
  const headings = () => {
    const columns = new Map<string, number>();
    sheet.getRow(HEADING_ROW).eachCell({ includeEmpty: false }, (cell, col) => {
      columns.set(cellText(cell.value).toLowerCase(), col);
    });
    return columns;
  };
  let columns = headings();
  if (!columns.has(PROBLEMS_KEY)) {
    // A .csv has no formatting to lose, so Problems goes first as in our own sheet (Q11, Q30);
    // an old .xlsx is never shifted.
    const at = csv ? 1 : Math.max(0, ...columns.values()) + 1;
    if (csv) sheet.spliceColumns(1, 0, []);
    sheet.getCell(HEADING_ROW, at).value = PROBLEMS_HEADING;
    columns = headings();
  }
  return { sheet, columns, problems: columns.get(PROBLEMS_KEY)!, firstRow: HEADING_ROW + 1 };
}

/**
 * A file marked before comes back fixed: last round's Problems and red cells are ours to clear.
 * Our red is also Excel's "Bad" style, so a red cell is ours only if its note holds a line that
 * row's Problems cell listed; the shop's own red cells and note lines are kept.
 */
function clearMarks({ sheet, problems, firstRow }: Target) {
  for (let row = firstRow; row <= sheet.rowCount; row += 1) {
    const cell = sheet.getCell(row, problems);
    const listed = new Set(cellText(cell.value).split(PROBLEM_SEPARATOR).filter(Boolean));
    if (cell.value !== null) cell.value = null;
    unpaintFill(cell);
    if (!listed.size) continue;
    // Empty cells too: a blank required cell is the commonest mark.
    sheet.getRow(row).eachCell({ includeEmpty: true }, (each) => {
      if (each !== cell) unpaint(each, listed);
    });
  }
}

// A fresh style object each time: loaded cells can share one, and mutating it would paint them all.
function paint(cell: ExcelJS.Cell) {
  cell.style = { ...cell.style, fill: MARK_FILL };
}

function unpaintFill(cell: ExcelJS.Cell) {
  const fill = cell.style.fill;
  if (fill?.type !== "pattern" || fill.fgColor?.argb !== MARK_ARGB) return;
  const { fill: _ours, ...rest } = cell.style;
  cell.style = rest;
}

function unpaint(cell: ExcelJS.Cell, listed: ReadonlySet<string>) {
  const lines = noteText(cell).split("\n");
  const theirs = lines.filter((line) => !listed.has(line));
  if (theirs.length === lines.length) return;
  unpaintFill(cell);
  // exceljs has no way to remove a note but its own field.
  if (theirs.length) cell.note = theirs.join("\n");
  else (cell as unknown as { _comment?: unknown })._comment = undefined;
}

function noteText(cell: ExcelJS.Cell): string {
  const note = cell.note;
  if (!note) return "";
  if (typeof note === "string") return note;
  return (note.texts ?? []).map((part) => part.text).join("");
}
