/**
 * Product by Slug API Route
 *
 * GET /api/products/[slug] - Get a single product by slug
 */

import { NextRequest, NextResponse } from "next/server";
import { productService } from "@server/catalog/product.service";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const product = await productService.getProductBySlug(slug);

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to fetch product:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch product",
      },
      { status: 400 }
    );
  }
}

