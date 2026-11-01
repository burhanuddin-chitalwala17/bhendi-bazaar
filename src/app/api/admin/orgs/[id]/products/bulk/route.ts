/**
 * The team creates a shop's products from its sheet (own-store/bulk-sheet D11): the shop's create,
 * re-validated in full, with a required reason and one audit entry. The shop is the path's.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { createRowsOf, teamBulkProductCreateSchema } from "@/lib/validation/schemas/bulk-product.schema";
import { bulkTeamService } from "@server/catalog/bulk/bulk-team.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id: orgId } = await params;
    const { rows, reason, fileName } = teamBulkProductCreateSchema.parse(await request.json());
    const result = await bulkTeamService.create(orgId, createRowsOf(rows), { reason, fileName }, adminId);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the products");
  }
}
