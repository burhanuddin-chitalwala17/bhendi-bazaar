/**
 * POST /api/admin/categories — create a category.
 *
 * There is no `GET`. The listing and the parent picker are both read by server components
 * through `adminCategoriesDAL`, so a route answering the same question was a round trip for
 * data the page already had ([ADR-0034]).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminCategoryService } from "@server/catalog/admin.category.service";
import type { CreateCategoryInput } from "@server/catalog/admin.category.types";
import { toErrorResponse } from "@/lib/api-error-response";
import { categoryFormSchema } from "@/lib/validation/schemas/category.schema";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const body = categoryFormSchema.parse(await request.json());
    const category = await adminCategoryService.createCategory(
      session.user.id,
      body,
    );

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create category");
  }
}
