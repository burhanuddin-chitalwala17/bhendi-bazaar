/**
 * Dry-run for a bulk product sheet (bulk-catalog-upload R3): parses, validates
 * every row, and reports every problem at once. Writes nothing; images have not
 * even been uploaded yet — that is the point of validating first.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { parseBulkProductRow } from "@/lib/validation/schemas/bulk-product.schema";
import {
  onTab,
  planProductRows,
  validateProductRows,
  type RowWithNumber,
} from "@server/catalog/bulk/bulk-product.service";
import type { BulkProductRow, RowError } from "@server/catalog/bulk/bulk.types";
import { bulkSheetService } from "@server/catalog/bulk/bulk-sheet.service";
import { nameColumns } from "@server/catalog/bulk/row-errors";
import { SHEET_AGE_COPY } from "@server/catalog/bulk/sheet-copy";
import { orgRepository } from "@server/catalog/org.repository";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const formData = await request.formData();
    const sheet = formData.get("sheet");
    if (!(sheet instanceof File))
      throw new DomainError("Attach the filled-in sheet.");
    let filenames: string[];
    try {
      filenames = JSON.parse(String(formData.get("filenames") ?? "[]"));
      if (!Array.isArray(filenames)) throw new Error();
    } catch {
      throw new DomainError(
        "filenames must be a JSON array of the dropped image names.",
      );
    }

    const raw = await parseSheet(
      Buffer.from(await sheet.arrayBuffer()),
      sheet.name,
    );

    // A sheet whose columns no longer read is refused before any row is judged by them (D4).
    const sheetAge = await bulkSheetService.judgeUpload(scope.orgId, raw);
    if (sheetAge.refusedColumn) {
      return NextResponse.json({
        ok: false,
        errors: [{ row: 0, field: "sheet", message: SHEET_AGE_COPY.tooOld(sheetAge.refusedColumn) }],
        rows: [],
        orgCode: null,
        summary: { rows: raw.rows.length, images: 0 },
        plan: { creates: 0, updates: 0 },
        sheet: sheetAge,
      });
    }

    const rows: RowWithNumber<BulkProductRow>[] = [];
    const errors: RowError[] = [];
    for (const rawRow of raw.rows) {
      const parsed = parseBulkProductRow(rawRow, raw.headers);
      if ("errors" in parsed) errors.push(...onTab(parsed.errors, rawRow.tab));
      else rows.push({ rowNumber: rawRow.rowNumber, tab: rawRow.tab, row: parsed.row });
    }
    errors.push(
      ...(await validateProductRows(scope.orgId, rows, filenames.map(String))),
    );
    errors.sort((a, b) => (a.tab ?? "").localeCompare(b.tab ?? "") || a.row - b.row);

    const [org, plan] = await Promise.all([
      orgRepository.findById(scope.orgId),
      planProductRows(scope.orgId, rows),
    ]);
    return NextResponse.json({
      ok: errors.length === 0,
      errors: nameColumns(errors, raw),
      rows: errors.length === 0 ? rows : [],
      orgCode: org?.code ?? null,
      summary: {
        rows: raw.rows.length,
        images: new Set(rows.flatMap(({ row }) => row.images)).size,
      },
      plan: { creates: plan.creates, updates: plan.updates.size },
      sheet: sheetAge,
    });
  } catch (error) {
    return toErrorResponse(error, "Could not check the sheet");
  }
});
