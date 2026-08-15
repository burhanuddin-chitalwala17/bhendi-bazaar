/**
 * GET /api/org/[orgId]/promotions/products?q= — the same search, scoped to this org.
 *
 * The scope comes from the route, so the picker cannot surface another org's goods
 * even before the create handler would refuse them.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { productsRepository } from "@server/catalog/product.repository";

export const GET = withOrg(async (request, scope) => {
  const search = new URL(request.url).searchParams.get("q") ?? undefined;
  return NextResponse.json(
    await productsRepository.listForPicker({ orgId: scope.orgId, search })
  );
});
