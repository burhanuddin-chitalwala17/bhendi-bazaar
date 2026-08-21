/** Dry-run for a bulk category sheet — the admin variant of the shared core (D6). */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { parseBulkCategoryRow } from "@/lib/validation/schemas/bulk-category.schema";
import {
  validateCategoryRows,
  type BulkCategoryRow,
  type CategoryRowWithNumber,
} from "@server/catalog/bulk/bulk-category.service";
import type { RowError } from "@server/catalog/bulk/bulk.types";

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const formData = await request.formData();
    const sheet = formData.get("sheet");
    if (!(sheet instanceof File)) throw new DomainError("Attach the filled-in sheet.");
    let filenames: string[];
    try {
      filenames = JSON.parse(String(formData.get("filenames") ?? "[]"));
      if (!Array.isArray(filenames)) throw new Error();
    } catch {
      throw new DomainError("filenames must be a JSON array of the dropped image names.");
    }

    const raw = await parseSheet(Buffer.from(await sheet.arrayBuffer()), sheet.name);
    const rows: CategoryRowWithNumber<BulkCategoryRow>[] = [];
    const errors: RowError[] = [];
    for (const rawRow of raw.rows) {
      const parsed = parseBulkCategoryRow(rawRow);
      if ("errors" in parsed) errors.push(...parsed.errors);
      else rows.push({ rowNumber: rawRow.rowNumber, row: parsed.row });
    }
    errors.push(...(await validateCategoryRows(rows, filenames.map(String))));
    errors.sort((a, b) => a.row - b.row);

    return NextResponse.json({
      ok: errors.length === 0,
      errors,
      rows: errors.length === 0 ? rows : [],
      summary: { rows: raw.rows.length },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not check the sheet");
  }
}
