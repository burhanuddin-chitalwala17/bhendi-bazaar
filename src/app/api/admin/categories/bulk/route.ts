/** Create every category from a validated sheet — all-or-nothing, re-validated. */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { bulkCategoryCreateSchema } from "@/lib/validation/schemas/bulk-category.schema";
import {
  createCategories,
  validateCategoryRows,
  type BulkCategoryCreateRow,
  type CategoryRowWithNumber,
} from "@server/catalog/bulk/bulk-category.service";

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const parsed = bulkCategoryCreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new DomainError(parsed.error.issues[0]?.message ?? "Invalid payload");
    }
    const rows: CategoryRowWithNumber<BulkCategoryCreateRow>[] = parsed.data.rows.map(
      (row, index) => ({ rowNumber: index + 2, row: row as BulkCategoryCreateRow })
    );
    const errors = await validateCategoryRows(
      rows,
      rows.map(({ row }) => row.image)
    );
    if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400 });

    const result = await createCategories(rows);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return toErrorResponse(error, "Could not create the categories");
  }
}
