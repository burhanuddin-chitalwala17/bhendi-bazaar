/**
 * PATCH  /api/admin/categories/[id] — update a category
 * DELETE /api/admin/categories/[id] — remove one
 *
 * There is no GET. The edit screen is a server component reading through
 * `adminCategoriesDAL`, so a handler answering the same question was a round trip for data
 * the page already had ([ADR-0034]).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminCategoryService } from "@server/catalog/admin.category.service";
import type { UpdateCategoryInput } from "@server/catalog/admin.category.types";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateCategorySchema } from "@/lib/validation/schemas/category.schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const body = updateCategorySchema.parse(await request.json());

    const category = await adminCategoryService.updateCategory(
      id,
      session.user.id,
      body,
    );

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    return toErrorResponse(error, "Could not update category");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    await adminCategoryService.deleteCategory(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not delete category");
  }
}
