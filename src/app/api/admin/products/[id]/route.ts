/**
 * Admin Single Product API Routes
 * GET /api/admin/products/[id] - Get product details
 * PATCH /api/admin/products/[id] - Update product
 * DELETE /api/admin/products/[id] - Delete product
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { productsService } from "@server/catalog/admin.product.service";
import { ProductFormInput } from "@/admin/products/types";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    await productsService.deleteProduct(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete product:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete product",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = (await request.json()) as ProductFormInput;
    const product = await productsService.updateProduct(id, body);
    return NextResponse.json(product);
  } catch (error) {
    console.error("Failed to update product:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update product",
      },
      { status: 400 }
    );
  }
}


