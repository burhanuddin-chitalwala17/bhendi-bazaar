/**
 * Create every product from a validated sheet — all-or-nothing (R3). The payload
 * is re-validated in full: validate-then-create is two requests, and nothing
 * stops a client editing the rows in between (Invariant 4).
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { bulkProductCreateSchema } from "@/lib/validation/schemas/bulk-product.schema";
import {
  createProducts,
  validateProductRows,
  type RowWithNumber,
} from "@server/catalog/bulk/bulk-product.service";
import type { BulkProductCreateRow } from "@server/catalog/bulk/bulk.types";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const parsed = bulkProductCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new DomainError(
        parsed.error.issues[0]?.message ?? "Invalid payload",
      );
    }

    const rows: RowWithNumber<BulkProductCreateRow>[] = parsed.data.rows.map(
      ({ rowNumber, tab, ...row }, index) => ({
        // The sheet's own row, so a late problem names the row the shop sees; index + 2 is
        // the legacy one-header sheet.
        rowNumber: rowNumber ?? index + 2,
        tab,
        row: row as BulkProductCreateRow,
      }),
    );

    // Same checks as the dry run; every named image must have an uploaded URL.
    const filenames = rows.flatMap(({ row }) => Object.keys(row.imageUrls));
    const errors = await validateProductRows(scope.orgId, rows, filenames);
    for (const { row, rowNumber, tab } of rows) {
      for (const filename of row.images) {
        if (!row.imageUrls[filename]) {
          errors.push({
            row: rowNumber,
            ...(tab ? { tab } : {}),
            field: "images",
            message: `No uploaded URL for "${filename}".`,
          });
        }
      }
    }
    if (errors.length) {
      return NextResponse.json({ ok: false, errors }, { status: 400 });
    }

    const result = await createProducts(scope.orgId, rows);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse(error, "Could not create the products");
  }
});
