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
      throw new DomainError(parsed.error.issues[0]?.message ?? "Invalid payload");
    }

    const rows: RowWithNumber<BulkProductCreateRow>[] = parsed.data.rows.map((row, index) => ({
      rowNumber: index + 2, // header is row 1, mirroring the sheet the user saw
      row: row as BulkProductCreateRow,
    }));

    // Same checks as the dry run; every named image must have an uploaded URL.
    const filenames = rows.flatMap(({ row }) => Object.keys(row.imageUrls));
    const errors = await validateProductRows(scope.orgId, rows, filenames);
    for (const { row, rowNumber } of rows) {
      for (const filename of row.images) {
        if (!row.imageUrls[filename]) {
          errors.push({ row: rowNumber, field: "images", message: `No uploaded URL for "${filename}".` });
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
