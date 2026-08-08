/**
 * PATCH  /api/org/[orgId]/products/[id]
 * DELETE /api/org/[orgId]/products/[id]
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { productsService } from "@server/catalog/admin.product.service";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { NotFoundError } from "@server/shared/domain-error";

/**
 * A product id in the path is the caller's to choose, so belonging to the scope's org is
 * checked rather than assumed. Reported as not-found rather than forbidden: whether some
 * other org owns that id is not this caller's business.
 */
async function assertOwnedByOrg(id: string, orgId: string) {
  const existing = await productsService.getProductById({ id });
  if (existing.org.id !== orgId) {
    throw new NotFoundError("Product not found");
  }
}

export const PATCH = withOrg<{ orgId: string; id: string }>(
  async (request, scope, params) => {
    await assertOwnedByOrg(params.id, scope.orgId);

    const body = productFormSchema.parse({
      ...(await request.json()),
      orgId: scope.orgId,
    });

    const product = await productsService.updateProduct(params.id, body);
    return NextResponse.json(product);
  }
);

export const DELETE = withOrg<{ orgId: string; id: string }>(
  async (_request, scope, params) => {
    await assertOwnedByOrg(params.id, scope.orgId);
    await productsService.deleteProduct(params.id);
    return NextResponse.json({ success: true });
  }
);
