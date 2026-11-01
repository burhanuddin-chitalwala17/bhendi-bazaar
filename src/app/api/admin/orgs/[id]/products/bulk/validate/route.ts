/** The shop's dry run, run by the team for the path's shop (own-store/bulk-sheet D11, Q18). Writes nothing. */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { parseBulkProductRow, readSheetUpload } from "@/lib/validation/schemas/bulk-product.schema";
import { checkProductSheet } from "@server/catalog/bulk/bulk-check.service";
import { bulkTeamService } from "@server/catalog/bulk/bulk-team.service";
import { parseSheet } from "@server/catalog/bulk/sheet";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await params;
    const { id: orgId } = await bulkTeamService.shop(id);
    const { sheet, filenames } = readSheetUpload(await request.formData());
    const raw = await parseSheet(Buffer.from(await sheet.arrayBuffer()), sheet.name);
    return NextResponse.json(await checkProductSheet(orgId, raw, filenames, parseBulkProductRow));
  } catch (error) {
    return toErrorResponse(error, "Could not check the sheet");
  }
}
