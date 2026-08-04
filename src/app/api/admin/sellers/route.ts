// src/app/api/admin/sellers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { adminSellerService } from "@server/catalog/seller.service";
import { createSellerSchema } from "@/lib/validation/schemas/seller.schema";
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("includeStats") === "true";

    const sellers = await adminSellerService.getAllSellers(includeStats);

    // ⭐ Make sure this always returns JSON
    return NextResponse.json(sellers);
  } catch (error: any) {
    console.error("GET /api/admin/sellers error:", error);
    // ⭐ Make sure error responses are also JSON
    return NextResponse.json(
      { error: error.message || "Failed to fetch sellers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createSellerSchema.parse(body);
    const seller = await adminSellerService.createSeller(validatedData);

    // ⭐ Return JSON with 201 status
    return NextResponse.json(seller, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/sellers error:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: error.errors,
          message: error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        },
        { status: 400 }
      );
    }

    if (error.message.includes("already exists")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // ⭐ Always return JSON, never throw unhandled
    return NextResponse.json(
      { error: error.message || "Failed to create seller" },
      { status: 500 }
    );
  }
}