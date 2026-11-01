/**
 * POST /api/admin/courier-conflicts/[id]/dismiss — the admin has seen an unmatched courier update
 * (order-fulfilment ux.md "admin conflicts"). No body: the row is the URL; its AWB's other open rows go too.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { dismissCourierConflict } from "@server/shipping/courier-conflict.service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    await dismissCourierConflict(id, session.user.name ?? "staff");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Could not dismiss the update");
  }
}
