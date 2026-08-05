// src/app/api/admin/sellers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { adminSellerService } from "@server/catalog/seller.service";
import { createSellerSchema } from "@/lib/validation/schemas/seller.schema";
import { toErrorResponse } from "@/lib/api-error-response";
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
  } catch (error) {
    return toErrorResponse(error, "Could not fetch sellers");
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
  } catch (error) {
    return toErrorResponse(error, "Could not create seller");
  }
}