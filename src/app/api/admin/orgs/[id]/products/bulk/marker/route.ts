/** The shop's file back with its problems marked, for the team (own-store/bulk-sheet D7, D11). Checked again in full. */
import { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { parseBulkProductRow, readSheetUpload } from "@/lib/validation/schemas/bulk-product.schema";
import { checkProductSheet } from "@server/catalog/bulk/bulk-check.service";
import { bulkTeamService } from "@server/catalog/bulk/bulk-team.service";
import { parseSheet } from "@server/catalog/bulk/sheet";
import { markProblems, XLSX_TYPE } from "@server/catalog/bulk/sheet-marker";
import { markedFileName } from "@server/catalog/bulk/sheet-copy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await params;
    const { id: orgId } = await bulkTeamService.shop(id);
    const { sheet, filenames } = readSheetUpload(await request.formData());
    const buffer = Buffer.from(await sheet.arrayBuffer());
    const raw = await parseSheet(buffer, sheet.name);
    const { errors } = await checkProductSheet(orgId, raw, filenames, parseBulkProductRow);
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
}
