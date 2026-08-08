/**
 * Admin Single Product API Routes
 * GET /api/admin/products/[id] - Get product details
 * PATCH /api/admin/products/[id] - Update product
 * DELETE /api/admin/products/[id] - Delete product
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { productsService } from "@server/catalog/admin.product.service";
import { ProductFormInput } from "@/admin/products/types";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin();
    const { id } = await params;
    await productsService.deleteProduct(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not delete the product");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin();
    const { id } = await params;
    const body = productFormSchema.parse(await request.json());
    const product = await productsService.updateProduct(id, body);
    return NextResponse.json(product);
  } catch (error) {
    return toErrorResponse(error, "Could not update the product");
  }
}


