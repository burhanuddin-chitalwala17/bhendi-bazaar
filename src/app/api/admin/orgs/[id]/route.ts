import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminOrgService } from "@server/catalog/org.service";
import { updateOrgSchema } from "@/lib/validation/schemas/org.schema";
import { toErrorResponse } from "@/lib/api-error-response";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requirePlatformAdmin();

    const body = await request.json();
    const validatedData = updateOrgSchema.parse({ ...body, id });
    const { id: _, ...updateData } = validatedData;

    const org = await adminOrgService.updateOrg(id, updateData);
    return NextResponse.json(org);
  } catch (error) {
    return toErrorResponse(error, "Could not update org");
  }
}

const blockActionSchema = z.object({
  action: z.enum(["block", "unblock"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    await requirePlatformAdmin();

    const body = await request.json();
    const { action } = blockActionSchema.parse(body);

    const org =
      action === "block"
        ? await adminOrgService.blockOrg(id)
        : await adminOrgService.unblockOrg(id);

    return NextResponse.json(org);
  } catch (error) {
    return toErrorResponse(error, "Could not update org status");
  }
}
