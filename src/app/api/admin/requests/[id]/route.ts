/**
 * GET /api/admin/requests/[id] — a requirement's preview, read live (setup-requests D7).
 * POST — Apply, Not now, or Mark fixed (Q6, Q11, Q22). A stale Apply writes nothing and answers
 * `{ stale: plan }`, the new preview, for the screen to show in place.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { requestActionSchema } from "@/lib/validation/schemas/requests.schema";
import { requestService } from "@server/requests/request.service";
import { recordAdminAction } from "@server/shared/audit/audit.service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;
    return NextResponse.json(await requestService.plan(id));
  } catch (error) {
    return toErrorResponse(error, "Couldn't read that request.");
  }
}

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await params;
    const body = requestActionSchema.parse(await request.json());
    if (body.action === "apply") {
      const outcome = await requestService.apply(id, { ...body.choice, hash: body.hash });
      if ("stale" in outcome) return NextResponse.json(outcome);
    } else if (body.action === "not_now") {
      await requestService.notNow(id);
    } else {
      await requestService.markFixed(id);
    }
    await recordAdminAction({ adminId, action: `request.${body.action}`, resource: "request", resourceId: id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, "Couldn't save that change. Nothing was changed.");
  }
}
