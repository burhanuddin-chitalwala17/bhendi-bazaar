/**
 * PATCH  /api/org/[orgId]/products/[id]
 * DELETE /api/org/[orgId]/products/[id]
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { productsService } from "@server/catalog/admin.product.service";
import { productEditSchema } from "@/lib/validation/schemas/product.schema";
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

    const body = productEditSchema.parse({
      ...(await request.json()),
      orgId: scope.orgId,
    });

    // The member saving is named on the product, and a shop save clears the team's mark (D7).
    const product = await productsService.updateProduct(params.id, body, { userId: scope.userId, team: false });
    return NextResponse.json(product);
  },
);

/**
 * Delete, and only for a product no record depends on (ADR-0029). Anything an order,
 * promotion or bidding event refers to is refused by name — archiving it is the
 * separate, reversible act, and it has its own route.
 */
export const DELETE = withOrg<{ orgId: string; id: string }>(
  async (_request, scope, params) => {
    await assertOwnedByOrg(params.id, scope.orgId);
    await productsService.deleteProduct(params.id);
    return NextResponse.json({ success: true });
  },
);
