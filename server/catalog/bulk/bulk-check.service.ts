/**
 * The whole check of an uploaded product sheet (own-store/bulk-sheet D4, D7, D8): what validate
 * answers and what the marked file is made from, so the two can never disagree.
 */
import { orgRepository } from "@server/catalog/org.repository";

import { onTab, planProductRows, validateProductRows, type RowWithNumber } from "./bulk-product.service";
import { bulkSheetService } from "./bulk-sheet.service";
import type { BulkProductRow, RowError } from "./bulk.types";
import { columnKeyOf, nameColumns } from "./row-errors";
import type { RawSheet, RawSheetRow } from "./sheet";
import { SHEET_AGE_COPY, type SheetAge } from "./sheet-copy";

/** The row schema lives with the routes' validation (`server/` never imports `src/`), so it is handed in. */
export type ParseProductRow = (
  raw: RawSheetRow,
  headers: readonly string[],
) => { row: BulkProductRow } | { errors: RowError[]; draft: BulkProductRow };

export interface ProductSheetCheck {
  ok: boolean;
  errors: RowError[];
  rows: RowWithNumber<BulkProductRow>[];
  orgCode: string | null;
  summary: { rows: number; images: number };
  plan: { creates: number; updates: number };
  sheet: SheetAge;
}

const cellOf = (error: RowError) => `${error.tab ?? ""}|${error.row}|${columnKeyOf(error.field)}`;

export async function checkProductSheet(
  orgId: string,
  raw: RawSheet,
  filenames: readonly string[],
  parseRow: ParseProductRow,
): Promise<ProductSheetCheck> {
  // A sheet whose columns no longer read is refused before any row is judged by them (D4).
  const sheetAge = await bulkSheetService.judgeUpload(orgId, raw);
  if (sheetAge.refusedColumn) {
    return {
      ok: false,
      errors: [{ row: 0, field: "sheet", message: SHEET_AGE_COPY.tooOld(sheetAge.refusedColumn) }],
      rows: [],
      orgCode: null,
      summary: { rows: raw.rows.length, images: 0 },
      plan: { creates: 0, updates: 0 },
      sheet: sheetAge,
    };
  }

  const rows: RowWithNumber<BulkProductRow>[] = [];
  // Typed rows and the drafts of broken ones, in sheet order, so a row's every problem shows at once (A4).
  const checked: RowWithNumber<BulkProductRow>[] = [];
  const errors: RowError[] = [];
  for (const rawRow of raw.rows) {
    const parsed = parseRow(rawRow, raw.headers);
    const at = { rowNumber: rawRow.rowNumber, tab: rawRow.tab };
    if ("errors" in parsed) {
      errors.push(...onTab(parsed.errors, rawRow.tab));
      checked.push({ ...at, row: parsed.draft });
    } else {
      rows.push({ ...at, row: parsed.row });
      checked.push({ ...at, row: parsed.row });
    }
  }
  // A cell the shape already refused is not named twice ("Category is required", then "not in the list").
  const shaped = new Set(errors.map(cellOf));
  const found = await validateProductRows(orgId, checked, filenames.map(String));
  errors.push(...found.filter((error) => !shaped.has(cellOf(error))));
  errors.sort((a, b) => (a.tab ?? "").localeCompare(b.tab ?? "") || a.row - b.row);

  const [org, plan] = await Promise.all([orgRepository.findById(orgId), planProductRows(orgId, rows)]);
  return {
    ok: errors.length === 0,
    errors: nameColumns(errors, raw),
    rows: errors.length === 0 ? rows : [],
    orgCode: org?.code ?? null,
    summary: { rows: raw.rows.length, images: new Set(rows.flatMap(({ row }) => row.images)).size },
    plan: { creates: plan.creates, updates: plan.updates.size },
    sheet: sheetAge,
  };
}
