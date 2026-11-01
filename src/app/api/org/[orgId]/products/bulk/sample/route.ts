/**
 * The shop's own workbook (own-store/bulk-sheet D1), built per request and never stored.
 * `?categories=a,b` are the ticked category ids; nothing ticked makes one Other tab.
 */
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { bulkSheetService } from "@server/catalog/bulk/bulk-sheet.service";

/** More ids than the catalogue has categories is not a request a shop makes. */
const MAX_TICKS = 500;

export const GET = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const ticked = (request.nextUrl.searchParams.get("categories") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_TICKS);
    const buffer = await bulkSheetService.buildSheet(scope.orgId, ticked);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="bulk-products-sheet.xlsx"',
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Couldn't make your sheet. Try again.");
  }
});
