/** The shop's workbook, made by the team for the path's shop (own-store/bulk-sheet D1, D11). Never stored. */
import { NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { bulkSheetService } from "@server/catalog/bulk/bulk-sheet.service";
import { bulkTeamService } from "@server/catalog/bulk/bulk-team.service";

/** More ids than the catalogue has categories is not a request anyone makes. */
const MAX_TICKS = 500;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id } = await params;
    const { id: orgId } = await bulkTeamService.shop(id);
    const ticked = (request.nextUrl.searchParams.get("categories") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, MAX_TICKS);
    const buffer = await bulkSheetService.buildSheet(orgId, ticked);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="bulk-products-sheet.xlsx"',
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Couldn't make your sheet. Try again.");
  }
}
