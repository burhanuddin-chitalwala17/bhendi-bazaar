import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateContactMessageSchema } from "@/lib/validation/schemas/contact.schema";
import { contactService } from "@server/support/contact.service";

/**
 * PATCH /api/admin/contact/[id] — move one message between Open and Resolved.
 *
 * Status is the only field an admin may change; everything else on the row is what the
 * sender wrote, and a store editing correspondence it received is not a feature.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const { status } = updateContactMessageSchema.parse(await request.json());

    await contactService.setStatus(id, status, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not update that message");
  }
}
