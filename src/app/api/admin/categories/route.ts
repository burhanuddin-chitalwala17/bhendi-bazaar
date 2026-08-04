/**
 * Admin Categories API Routes
 * GET /api/admin/categories - List categories
 * POST /api/admin/categories - Create new category
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminCategoryService } from "@server/catalog/admin.category.service";
import type {
  CategoryListFilters,
  CreateCategoryInput,
} from "@server/catalog/admin.category.types";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);

    const filters: CategoryListFilters = {
      search: searchParams.get("search") || undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "50"),
      sortBy: (searchParams.get("sortBy") as any) || "order",
      sortOrder: (searchParams.get("sortOrder") as any) || "asc",
    };

    const result = await adminCategoryService.getCategories(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch categories",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const body = (await request.json()) as CreateCategoryInput;
    const category = await adminCategoryService.createCategory(
      session.user.id,
      body
    );

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create category",
      },
      { status: 400 }
    );
  }
}


