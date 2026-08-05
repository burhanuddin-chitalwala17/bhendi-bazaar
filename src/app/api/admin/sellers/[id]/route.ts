// src/app/api/admin/sellers/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { adminSellerService } from "@server/catalog/seller.service";
import { updateSellerSchema } from "@/lib/validation/schemas/seller.schema";
import { toErrorResponse } from "@/lib/api-error-response";


/**
 * PUT /api/admin/sellers/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ⭐ params is Promise
) {
  try {
    // ⭐ Await params first
    const { id } = await params;
    
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const body = await request.json();
    const validatedData = updateSellerSchema.parse({
      ...body,
      id, // ⭐ Now id is properly unwrapped
    });

    // Remove id from update data
    const { id: _, ...updateData } = validatedData;

    // Update seller via service
    const seller = await adminSellerService.updateSeller(id, updateData);

    return NextResponse.json(seller);
  } catch (error) {
    return toErrorResponse(error, "Could not update seller");
  }
}

/**
 * DELETE /api/admin/sellers/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ⭐ params is Promise
) {
  try {
    // ⭐ Await params first
    const { id } = await params;
    
    // Auth check
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete seller via service
    await adminSellerService.deleteSeller(id);

    return NextResponse.json({ 
      success: true,
      message: "Seller deleted successfully" 
    });
  } catch (error) {
    return toErrorResponse(error, "Could not delete seller");
  }
}