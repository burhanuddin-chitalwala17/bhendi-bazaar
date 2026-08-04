/**
 * Similar Products API Route
 *
 * GET /api/products/[slug]/similar - Get similar products for recommendations
 */

import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const { searchParams } = request.nextUrl;
    const limit = searchParams.has("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 4;

    const products = await productService.getSimilarProducts(slug, limit);
    return NextResponse.json(products);
  } catch (error) {
    console.error("Failed to fetch similar products:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch similar products",
      },
      { status: 400 }
    );
  }
}

