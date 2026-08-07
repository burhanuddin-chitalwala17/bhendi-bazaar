// src/app/api/admin/orgs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { adminOrgService } from "@server/catalog/org.service";
import { createOrgSchema } from "@/lib/validation/schemas/org.schema";
import { toErrorResponse } from "@/lib/api-error-response";
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get("includeStats") === "true";

    const orgs = await adminOrgService.getAllOrgs(includeStats);

    // ⭐ Make sure this always returns JSON
    return NextResponse.json(orgs);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch orgs");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createOrgSchema.parse(body);
    const org = await adminOrgService.createOrg(validatedData);

    // ⭐ Return JSON with 201 status
    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create org");
  }
}