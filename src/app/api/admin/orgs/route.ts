// src/app/api/admin/orgs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminOrgService } from "@server/catalog/org.service";
import { createOrgSchema } from "@/lib/validation/schemas/org.schema";
import { toErrorResponse } from "@/lib/api-error-response";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const orgs = await adminOrgService.listOrgs({
      page: resolvePageNumber(searchParams.get("page")),
      limit: resolvePageSize(searchParams.get("limit")),
      search: searchParams.get("search") || undefined,
      // Only "active" and "inactive" narrow; anything else — "all", a typo — is everything.
      isActive: status === "active" ? true : status === "inactive" ? false : undefined,
    });

    return NextResponse.json(orgs);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch orgs");
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();

    const body = await request.json();
    const validatedData = createOrgSchema.parse(body);
    const org = await adminOrgService.createOrg(validatedData);

    // ⭐ Return JSON with 201 status
    return NextResponse.json(org, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create org");
  }
}