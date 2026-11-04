/**
 * POST /api/admin/products/bulk-edit — the Bhendi Bazaar team acts on selected shop products at
 * once (design-system Q29), with the reason each shop will read (product-form D11). The team
 * leaves archived products alone (ADR-0029); a send goes through each product's own shop.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { teamBulkProductActionSchema } from "@/lib/validation/schemas/product-bulk.schema";
import { productTeamService } from "@server/catalog/product-team.service";
import { BULK_ACTION, BULK_ACTOR, type BulkActor } from "@server/catalog/product-bulk.types";
import { listingPublishService } from "@server/channels/listing-publish.service";

export async function POST(request: NextRequest) {
  try {
    const adminId = await requirePlatformAdminId();
    const body = teamBulkProductActionSchema.parse(await request.json());
    const { reason, ...action } = body;
    if (action.action === BULK_ACTION.SEND) {
      const actor: BulkActor = { kind: BULK_ACTOR.TEAM, userId: adminId, reason };
      return NextResponse.json(await listingPublishService.bulkSend(actor, action.channel, action.productIds));
    }
    // Price, stock and archive go through the team service, which names the admin and records the reason.
    return NextResponse.json(await productTeamService.bulkEdit(adminId, reason, action));
  } catch (error) {
    return toErrorResponse(error, "Couldn't apply that to the selected products. Try again.");
  }
}
