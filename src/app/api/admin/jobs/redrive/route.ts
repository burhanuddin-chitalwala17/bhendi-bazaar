/**
 * POST /api/admin/jobs/redrive — move every parked job back onto the queue.
 *
 * Called from the worker card on the admin dashboard. No body: the action is the whole
 * request. Recorded in the audit trail with how many jobs moved (worker-foundation R11).
 */
import { NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { redriveFailedJobs } from "@server/shared/jobs";
import { recordAdminAction } from "@server/shared/audit/audit.service";

export async function POST() {
  try {
    const adminId = await requirePlatformAdminId();
    const moved = await redriveFailedJobs();
    await recordAdminAction({
      adminId,
      action: "jobs.redrive",
      resource: "jobs",
      resourceId: "jobs_failed",
      metadata: { moved },
    });
    return NextResponse.json({ moved });
  } catch (error) {
    return toErrorResponse(error, "Could not re-run the failed jobs");
  }
}
