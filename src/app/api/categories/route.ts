/**
 * Categories API Routes
 *
 * GET /api/categories - List all categories
 */

import { NextResponse } from "next/server";
import { categoryService } from "@server/catalog/category.service";

export async function GET() {
  try {
    const categories = await categoryService.getCategories();
    return NextResponse.json(categories);
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

