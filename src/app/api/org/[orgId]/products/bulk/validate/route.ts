/**
 * Dry-run for a bulk product sheet (bulk-catalog-upload R3): parses, validates
 * every row, and reports every problem at once. Writes nothing; images have not
 * even been uploaded yet — that is the point of validating first.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { parseBulkProductRow, readSheetUpload } from "@/lib/validation/schemas/bulk-product.schema";
import { checkProductSheet } from "@server/catalog/bulk/bulk-check.service";
import { parseSheet } from "@server/catalog/bulk/sheet";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const { sheet, filenames } = readSheetUpload(await request.formData());
    const raw = await parseSheet(Buffer.from(await sheet.arrayBuffer()), sheet.name);
    return NextResponse.json(await checkProductSheet(scope.orgId, raw, filenames, parseBulkProductRow));
  } catch (error) {
    return toErrorResponse(error, "Could not check the sheet");
  }
});
