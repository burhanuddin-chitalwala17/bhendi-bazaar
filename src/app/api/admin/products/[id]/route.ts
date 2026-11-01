/**
 * PATCH /api/admin/products/[id] — the Bhendi Bazaar team fixes a shop's product (product-form
 * D11, D12). The shop's own edit — version compare-and-set included — with the admin as editor, a
 * required reason and one audit entry. The org is the product's; whatever the body says is dropped.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { teamProductEditSchema } from "@/lib/validation/schemas/product.schema";
import { productTeamService } from "@server/catalog/product-team.service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    const body = teamProductEditSchema.parse(await request.json());
    return NextResponse.json(await productTeamService.update(id, body, adminId));
  } catch (error) {
    return toErrorResponse(error, "Couldn't save. Try again.");
  }
}
