/**
 * GET  /api/org/[orgId]/products - this org's products
 * POST /api/org/[orgId]/products - create a product owned by this org
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { productsService } from "@server/catalog/admin.product.service";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";

export const GET = withOrg(async (request, scope) => {
  const { searchParams } = new URL(request.url);

  // Every filter is the caller's; `orgId` is not. It comes from the membership the
  // wrapper verified, so a query string cannot widen the result set.
  const products = await productsService.getProducts({
    orgId: scope.orgId,
    search: searchParams.get("search") || undefined,
    categoryId: searchParams.get("category") || undefined,
    page: Number(searchParams.get("page")) || 1,
    limit: Number(searchParams.get("limit")) || 10,
  });

  return NextResponse.json(products);
});

export const POST = withOrg(async (request, scope) => {
  // The scope's org is injected *before* parsing, so whatever `orgId` the client sent is
  // overwritten rather than trusted. Without this, a member of one org could create a
  // product owned by another by editing the payload — the org is server-owned here in
  // exactly the sense Invariant 4 means.
  const body = productFormSchema.parse({
    ...(await request.json()),
    orgId: scope.orgId,
  });

  const product = await productsService.createProduct(body);
  return NextResponse.json(product, { status: 201 });
});
