/**
 * GET /api/admin/orgs/[id]/listing-values?lists=colour,material — the shop's permitted answers for
 * the team's form (product-form D12), the shop's own additions included.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { listingValueRepository } from "@server/listing/listing-value.repository";

/** A form asks a handful of questions; a longer list is a caller that has lost its way. */
const MAX_LISTS = 20;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id: orgId } = await params;
    const lists = (request.nextUrl.searchParams.get("lists") ?? "")
      .split(",")
      .map((list) => list.trim())
      .filter(Boolean)
      .slice(0, MAX_LISTS);
    return NextResponse.json(await listingValueRepository.byLists(lists, orgId));
  } catch (error) {
    return toErrorResponse(error, "Could not load the answers");
  }
}
