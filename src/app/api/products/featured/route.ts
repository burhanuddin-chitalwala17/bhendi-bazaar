/**
 * Featured/Hero Products API Route
 *
 * GET /api/products/featured - Get featured/hero products for homepage
 */

import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = searchParams.has("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 6;

    const products = await productService.getHeroProducts(limit);
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch featured products:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch featured products",
      },
      { status: 400 }
    );
  }
}

