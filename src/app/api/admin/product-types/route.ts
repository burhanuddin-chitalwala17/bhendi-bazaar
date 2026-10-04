import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { adminProductTypeService } from "@server/catalog/admin.product-type.service";
import { createProductTypeSchema } from "@server/catalog/admin.product-type.types";

/**
 * The question sets an admin creates
 * ([product-types](../../../../../docs/specs/listing-vocabulary/product-types/) R1).
 *
 * A browser must call these: the list screen creates from a form, which is what earns a route
 * handler at all. Reads a page can do itself go through the data-access layer instead.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const includeRetired = request.nextUrl.searchParams.get("includeRetired") === "true";
    return NextResponse.json(await adminProductTypeService.list(includeRetired));
  } catch (error) {
    return toErrorResponse(error, "Could not load product types");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const body = createProductTypeSchema.parse(await request.json());
    const created = await adminProductTypeService.create(session.user.id, body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the product type");
  }
}
