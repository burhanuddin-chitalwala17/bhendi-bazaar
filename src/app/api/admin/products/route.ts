/**
 * Admin Products API Routes
 * GET /api/admin/products - List products with filters
 * POST /api/admin/products - Create new product
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { productsService } from "@server/catalog/admin.product.service";
import type {
  ProductFilters,
  ProductFormInput,
} from "@/admin/products/types";
import { ProductFlag } from "@/types/product";


export async function POST(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const body = (await request.json()) as ProductFormInput;
    const product = await productsService.createProduct(body);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Failed to create product:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create product",
      },
      { status: 400 }
    );
  }
}


