/**
 * Products API Routes
 *
 * GET /api/products - List products with optional filtering
 */

import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";
import type { ProductFilter } from "@server/catalog/product.types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // Build filter from query parameters
    const filter: ProductFilter = {};

    if (searchParams.has("categorySlug")) {
      filter.categorySlug = searchParams.get("categorySlug")!;
    }

    if (searchParams.has("search")) {
      filter.search = searchParams.get("search")!;
    }

    if (searchParams.has("minPrice")) {
      filter.minPrice = parseFloat(searchParams.get("minPrice")!);
    }

    if (searchParams.has("maxPrice")) {
      filter.maxPrice = parseFloat(searchParams.get("maxPrice")!);
    }

    if (searchParams.has("offerOnly")) {
      filter.offerOnly = searchParams.get("offerOnly") === "true";
    }

    if (searchParams.has("featuredOnly")) {
      filter.featuredOnly = searchParams.get("featuredOnly") === "true";
    }

    if (searchParams.has("limit")) {
      filter.limit = parseInt(searchParams.get("limit")!, 10);
    }

    if (searchParams.has("offset")) {
      filter.offset = parseInt(searchParams.get("offset")!, 10);
    }

    const products = await productService.getProducts(filter);
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch products",
      },
      { status: 400 }
    );
  }
}

