import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { adminProductTypeService } from "@server/catalog/admin.product-type.service";
import { updateProductTypeSchema } from "@server/catalog/admin.product-type.types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { key } = await params;
    const body = updateProductTypeSchema.parse(await request.json());
    return NextResponse.json(await adminProductTypeService.update(key, session.user.id, body));
  } catch (error) {
    return toErrorResponse(error, "Could not update the product type");
  }
}

/**
 * Retires rather than deletes (spec R4). The foreign keys refuse a delete while any product or
 * category names the type; retiring hides it from the pickers and changes nothing already
 * stored, which is what an admin actually wants when a line stops being carried.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { key } = await params;
    return NextResponse.json(await adminProductTypeService.retire(key, session.user.id));
  } catch (error) {
    return toErrorResponse(error, "Could not retire the product type");
  }
}
