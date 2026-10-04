/**
 * GET /api/org/[orgId]/listing-values?lists=colour,material — the permitted answers for a
 * handful of questions ([categories](../../../../../../docs/specs/listing-vocabulary/categories/) D3).
 *
 * A route handler because a browser must call it: changing a product's category changes which
 * questions it is asked, and the answers for those are not the ones the page loaded with. That
 * is a fetch triggered by an interaction, which is what earns a handler — the first load is
 * served by the page itself ([ADR-0034](../../../../../../docs/adr/0034-render-on-the-server-by-default.md)).
 *
 * Under `/api/org`, not `/api/admin`: the answers include the shop's own additions, so this is
 * read as a member of that org rather than as a platform admin.
 *
 * Always by list, never all of them: there are a thousand values and a form needs the few its
 * own type asks about (product-types D5).
 */

import { NextResponse } from "next/server";

import { withOrg } from "@/lib/org-auth";
import { listingValueRepository } from "@server/catalog/listing-value.repository";

/** A form asks a handful of questions; a longer list is a caller that has lost its way. */
const MAX_LISTS = 20;

export const GET = withOrg(async (request, scope) => {
  const lists = (request.nextUrl.searchParams.get("lists") ?? "")
    .split(",")
    .map((list) => list.trim())
    .filter(Boolean)
    .slice(0, MAX_LISTS);

  // The org comes from the verified membership, never the query string (Invariant 4).
  return NextResponse.json(await listingValueRepository.byLists(lists, scope.orgId));
});
