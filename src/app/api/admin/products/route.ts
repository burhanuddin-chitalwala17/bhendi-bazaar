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
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { toErrorResponse } from "@/lib/api-error-response";


export async function POST(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const body = productFormSchema.parse(await request.json());
    const product = await productsService.createProduct(body);

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create the product");
  }
}


