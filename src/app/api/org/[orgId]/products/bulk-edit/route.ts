/**
 * POST /api/org/[orgId]/products/bulk-edit — a shop acts on its selected products at once
 * (design-system Q29): price, stock, archive or send to a marketplace. Any member may, as any
 * member may edit one product. Every statement is scoped to the path's org, so another shop's id
 * in the body is reported as not found, never touched. "Select all" sends the list's filters
 * instead of ids (design-system Q35); the products are found here, in the path's org, capped.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { bulkProductActionSchema } from "@/lib/validation/schemas/product-bulk.schema";
import { productBulkService } from "@server/catalog/product-bulk.service";
import { BULK_ACTION, BULK_ACTOR, MAX_BULK_PRODUCTS, type BulkActor } from "@server/catalog/product-bulk.types";
import { listingPublishService } from "@server/channels/listing-publish.service";
import { adminProductsDAL } from "@/data-access-layer/admin/products.dal";
import type { ProductListScope } from "@/lib/validation/schemas/product-list.schema";

/** The ids an action lands on: as named, or every product the shop's own filters match. */
const idsFor = (orgId: string, body: { productIds?: string[]; matching?: ProductListScope }): Promise<string[]> | string[] =>
  body.matching ? adminProductsDAL.matchingIds({ ...body.matching, orgId }, MAX_BULK_PRODUCTS) : (body.productIds ?? []);

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  const body = bulkProductActionSchema.parse(await request.json());
  const actor: BulkActor = { kind: BULK_ACTOR.ORG, orgId: scope.orgId, userId: scope.userId };
  switch (body.action) {
    case BULK_ACTION.PRICE:
      return NextResponse.json(await productBulkService.setPrice(actor, await idsFor(scope.orgId, body), body.change));
    case BULK_ACTION.STOCK:
      return NextResponse.json(await productBulkService.setStock(actor, body.rows));
    case BULK_ACTION.ARCHIVE:
      return NextResponse.json(await productBulkService.archive(actor, await idsFor(scope.orgId, body)));
    case BULK_ACTION.SEND:
      return NextResponse.json(await listingPublishService.bulkSend(actor, body.channel, await idsFor(scope.orgId, body)));
  }
});
