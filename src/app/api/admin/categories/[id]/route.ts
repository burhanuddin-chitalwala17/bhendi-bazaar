/**
 * Admin Single Category API Routes
 * GET /api/admin/categories/[id] - Get category details
 * PATCH /api/admin/categories/[id] - Update category
 * DELETE /api/admin/categories/[id] - Delete category
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminCategoryService } from "@server/catalog/admin.category.service";
import type { UpdateCategoryInput } from "@server/catalog/admin.category.types";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateCategorySchema } from "@/lib/validation/schemas/category.schema";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const category = await adminCategoryService.getCategoryById(id);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch category");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = updateCategorySchema.parse(await request.json());

    const category = await adminCategoryService.updateCategory(
      id,
      session.user.id,
      body
    );

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    return toErrorResponse(error, "Could not update category");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    await adminCategoryService.deleteCategory(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not delete category");
  }
}


