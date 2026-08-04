// src/app/api/admin/sellers/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { adminSellerService } from "@server/catalog/seller.service";
import { updateSellerSchema } from "@/lib/validation/schemas/seller.schema";


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
  } catch (error: any) {
    console.error("PUT /api/admin/sellers/[id] error:", error);

    // Zod validation error
    if (error.name === "ZodError") {
      const errorDetails = error.errors || [];
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: errorDetails,
          message: errorDetails.length > 0
            ? errorDetails.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
            : error.message || "Invalid data"
        },
        { status: 400 }
      );
    }

    // Not found
    if (error.message === "Seller not found") {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // Business logic errors
    if (error.message.includes("already exists")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to update seller" },
      { status: 500 }
    );
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
  } catch (error: any) {
    console.error("DELETE /api/admin/sellers/[id] error:", error);

    // Not found
    if (error.message === "Seller not found") {
      return NextResponse.json({ error: "Seller not found" }, { status: 404 });
    }

    // Has products
    if (error.message.includes("Cannot delete seller with products")) {
      return NextResponse.json(
        { 
          error: error.message,
          details: "Please reassign or delete products first"
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete seller" },
      { status: 500 }
    );
  }
}