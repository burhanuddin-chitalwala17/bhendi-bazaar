/**
 * Category by Slug API Route
 *
 * GET /api/categories/[slug] - Get a single category by slug
 */

import { NextRequest, NextResponse } from "next/server";
import { categoryService } from "@server/catalog/category.service";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const category = await categoryService.getCategoryBySlug(slug);

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
      { status: 400 }
    );
  }
}

