/**
 * PATCH /api/org/[orgId]/products/[id]/archive
 *
 * Takes a product off sale or puts it back (ADR-0029). Separate from PATCH on the
 * product itself: withdrawing is not an edit to the product's content, and must stay
 * available for a product whose form would not currently validate.
 */

import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { productsService } from "@server/catalog/admin.product.service";
import { productArchiveSchema } from "@/lib/validation/schemas/product.schema";

export const PATCH = withOrg<{ orgId: string; id: string }>(
  async (request, scope, params) => {
    const { archived } = productArchiveSchema.parse(await request.json());
    const actor = { orgId: scope.orgId, userId: scope.userId };

    // Ownership is established inside the service, which reports a product belonging
    // to another org as not-found rather than forbidden.
    const product = archived
      ? await productsService.archiveProduct(params.id, actor)
      : await productsService.restoreProduct(params.id, actor);

    return NextResponse.json({ id: product.id, archivedAt: product.archivedAt });
  }
);
