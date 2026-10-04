/**
 * The families an org's products belong to
 * ([variants](../../../../../../docs/specs/listing-vocabulary/variants/) R2).
 *
 * A family is what an abaya in four colours has in common. `POST` makes one; the listing is read
 * by the product form's page on the server, so there is no `GET`
 * ([ADR-0034](../../../../../../docs/adr/0034-render-on-the-server-by-default.md)).
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { productFamilyService } from "@server/catalog/product-family.service";
import { createFamilySchema } from "@/lib/validation/schemas/family.schema";

export const POST = withOrg(async (request, scope) => {
  // The org comes from the verified membership, never the payload (Invariant 4).
  const body = createFamilySchema.parse(await request.json());
  const family = await productFamilyService.create(scope.orgId, body);
  return NextResponse.json(family, { status: 201 });
});
