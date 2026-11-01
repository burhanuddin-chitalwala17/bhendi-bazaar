/**
 * POST /api/admin/orgs/[id]/products — the Bhendi Bazaar team adds a product for a shop
 * (product-form D11, D12; own-store Q17). Same form and checks as the shop's own create, plus a
 * required reason, and one audit entry. The shop is the path's, never the body's (Invariant 4).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { teamProductFormSchema } from "@/lib/validation/schemas/product.schema";
import { productTeamService } from "@server/catalog/product-team.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id: orgId } = await params;
    const { orgId: _ignored, ...body } = teamProductFormSchema.parse({ ...(await request.json()), orgId });
    const product = await productTeamService.create(orgId, body, adminId);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Couldn't save. Try again.");
  }
}
