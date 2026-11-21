/**
 * GET  /api/admin/orgs/[id]/credits — one shop's credit as the admin sees it: lines with cost and margin
 * POST /api/admin/orgs/[id]/credits — record an offline top-up with its proof (ai-images/shop-credits R3)
 *
 * Platform admin only. A top-up is money the admin saw arrive, never a price; audited in the service.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { topUpSchema } from "@/lib/validation/schemas/credit.schema";
import { creditService } from "@server/payouts/credit.service";
import { creditPageOf } from "@/lib/validation/schemas/credit.schema";
import { adminOrgService } from "@server/catalog/org.service";
import { NotFoundError } from "@server/shared/domain-error";

type Context = { params: Promise<{ id: string }> };

async function requireOrg(id: string) {
  const [org] = await adminOrgService.summariesFor([id]);
  if (!org) throw new NotFoundError("Shop not found");
}

export async function GET(request: NextRequest, context: Context) {
  try {
    await requirePlatformAdminId();
    const { id } = await context.params;
    await requireOrg(id);
    const page = creditPageOf(new URL(request.url).searchParams);
    return NextResponse.json(await creditService.adminAccount(id, page));
  } catch (error) {
    return toErrorResponse(error, "Could not load this shop's credit");
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await context.params;
    await requireOrg(id);
    const { amountPaise, ...proof } = topUpSchema.parse(await request.json());
    await creditService.recordTopUp(id, amountPaise, proof, adminId);
    return NextResponse.json(await creditService.adminAccount(id));
  } catch (error) {
    return toErrorResponse(error, "Could not record the top-up");
  }
}
