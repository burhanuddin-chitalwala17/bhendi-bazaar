/**
 * Offer Products API Route
 *
 * GET /api/products/offers - Get products on offer
 */

import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const limit = searchParams.has("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 10;

    const products = await productService.getOfferProducts(limit);
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch offer products:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch offer products",
      },
      { status: 400 }
    );
  }
}

