/**
 * GET /api/admin/jobs — the newest jobs on the queue, for the worker card's expandable list.
 *
 * Fetched when the list is opened, so the dashboard itself never pays for it (worker-foundation R5).
 */
import { NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { recentJobs } from "@server/shared/jobs";

export async function GET() {
  try {
    await requirePlatformAdminId();
    return NextResponse.json({ jobs: await recentJobs() });
  } catch (error) {
    return toErrorResponse(error, "Could not read the jobs");
  }
}
