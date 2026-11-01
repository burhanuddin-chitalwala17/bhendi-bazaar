/**
 * The shop's own file back with its problems marked (own-store/bulk-sheet D7). The file is sent
 * again and checked again in full: what is marked is never taken from the client.
 */
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { parseBulkProductRow, readSheetUpload } from "@/lib/validation/schemas/bulk-product.schema";
import { checkProductSheet } from "@server/catalog/bulk/bulk-check.service";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { markProblems, XLSX_TYPE } from "@server/catalog/bulk/sheet-marker";
import { markedFileName } from "@server/catalog/bulk/sheet-copy";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const { sheet, filenames } = readSheetUpload(await request.formData());
    const buffer = Buffer.from(await sheet.arrayBuffer());
    const raw = await parseSheet(buffer, sheet.name);
    const { errors } = await checkProductSheet(scope.orgId, raw, filenames, parseBulkProductRow);
    const marked = await markProblems(buffer, sheet.name, errors);
    return new Response(new Uint8Array(marked), {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="${markedFileName(sheet.name)}"`,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Couldn't mark your sheet. Try again.");
  }
});
