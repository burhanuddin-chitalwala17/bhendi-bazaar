/**
 * POST /api/admin/products/[id]/restore — an archived shop product back on sale, so the team can
 * edit it (product-form D12, ADR-0029). The archive trail records the restore under the admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { productTeamService } from "@server/catalog/product-team.service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    const product = await productTeamService.restore(id, adminId);
    return NextResponse.json({ id: product.id, archivedAt: product.archivedAt });
  } catch (error) {
    return toErrorResponse(error, "Could not restore the product");
  }
}
