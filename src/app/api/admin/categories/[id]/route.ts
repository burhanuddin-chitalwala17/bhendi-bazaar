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
    console.error("Failed to fetch category:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch category",
      },
      { status: 500 }
    );
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
    const body = (await request.json()) as UpdateCategoryInput;

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
    console.error("Failed to update category:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update category",
      },
      { status: 400 }
    );
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
    console.error("Failed to delete category:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete category",
      },
      { status: 400 }
    );
  }
}


