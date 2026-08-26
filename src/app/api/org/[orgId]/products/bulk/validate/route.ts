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
import { validateProductRows, type RowWithNumber } from "@server/catalog/bulk/bulk-product.service";
import type { BulkProductRow, RowError } from "@server/catalog/bulk/bulk.types";
import { orgRepository } from "@server/catalog/org.repository";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
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

    const rows: RowWithNumber<BulkProductRow>[] = [];
    const errors: RowError[] = [];
    for (const rawRow of raw.rows) {
      const parsed = parseBulkProductRow(rawRow);
      if ("errors" in parsed) errors.push(...parsed.errors);
      else rows.push({ rowNumber: rawRow.rowNumber, row: parsed.row });
    }
    errors.push(...(await validateProductRows(scope.orgId, rows, filenames.map(String))));
    errors.sort((a, b) => a.row - b.row);

    const org = await orgRepository.findById(scope.orgId);
    return NextResponse.json({
      ok: errors.length === 0,
      errors,
      rows: errors.length === 0 ? rows : [],
      orgCode: org?.code ?? null,
      summary: {
        rows: raw.rows.length,
        images: new Set(rows.flatMap(({ row }) => row.images)).size,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not check the sheet");
  }
});
