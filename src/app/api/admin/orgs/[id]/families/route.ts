/**
 * POST /api/admin/orgs/[id]/families — a family made from the team's form, owned by the shop
 * (product-form D12; variants R2).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { productFamilyService } from "@server/listing/product-family.service";
import { createFamilySchema } from "@/lib/validation/schemas/family.schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id: orgId } = await params;
    const family = await productFamilyService.create(orgId, createFamilySchema.parse(await request.json()));
    return NextResponse.json(family, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the family");
  }
}
