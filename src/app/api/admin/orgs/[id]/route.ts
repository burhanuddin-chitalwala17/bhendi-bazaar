// src/app/api/admin/orgs/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminOrgService } from "@server/catalog/org.service";
import { updateOrgSchema } from "@/lib/validation/schemas/org.schema";
import { toErrorResponse } from "@/lib/api-error-response";


/**
 * PUT /api/admin/orgs/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ⭐ params is Promise
) {
  try {
    // ⭐ Await params first
    const { id } = await params;
    
    // Auth check
    await requirePlatformAdmin();

    // Parse and validate body
    const body = await request.json();
    const validatedData = updateOrgSchema.parse({
      ...body,
      id, // ⭐ Now id is properly unwrapped
    });

    // Remove id from update data
    const { id: _, ...updateData } = validatedData;

    // Update org via service
    const org = await adminOrgService.updateOrg(id, updateData);

    return NextResponse.json(org);
  } catch (error) {
    return toErrorResponse(error, "Could not update org");
  }
}

/**
 * DELETE /api/admin/orgs/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ⭐ params is Promise
) {
  try {
    // ⭐ Await params first
    const { id } = await params;
    
    // Auth check
    await requirePlatformAdmin();

    // Delete org via service
    await adminOrgService.deleteOrg(id);

    return NextResponse.json({ 
      success: true,
      message: "Organisation deleted successfully" 
    });
  } catch (error) {
    return toErrorResponse(error, "Could not delete org");
  }
}