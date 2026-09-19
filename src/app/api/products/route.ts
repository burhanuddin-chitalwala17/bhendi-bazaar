/**
 * GET /api/products — the next page of any product listing.
 *
 * One route behind every grid in the store: the storefront, a category, search and
 * offers all continue themselves through here, so there is one place that decides what
 * a listing may return and one page size to keep in step.
 *
 * A route handler because a browser must call it — more rows as a shopper scrolls is a
 * fetch triggered by interaction, not something a server component could have read
 * (CLAUDE.md).
 *
 * **A shop is named by handle, never by id.** The handle is public and resolves here to
 * an org; an `orgId` accepted from a caller is exactly how a storefront listing would
 * stop being scoped to its own shop (ADR-0030 decision 6). Visibility — `ON_SALE`,
 * `FROM_ACTIVE_ORG` — rides inside `getProducts`, so page two of a withdrawn shop is as
 * empty as page one.
 */

import { NextResponse } from "next/server";

import { productsDAL } from "@/data-access-layer/products.dal";
import { storefrontDAL } from "@/data-access-layer/storefront.dal";
import { PRODUCT_PAGE_SIZE, productPageParams } from "@/lib/product-paging";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: Request) {
  try {
    const { offset, handle, category, q, offers, sort } =
      productPageParams.parse(
        Object.fromEntries(new URL(request.url).searchParams),
      );

    let orgId: string | undefined;
    if (handle) {
      const shop = await storefrontDAL.getByHandle(handle);
      // A retired handle or a withdrawn shop has no page two. Not a redirect: this is
      // fetched by script, and the grid's correct response is to stop asking.
      if (!shop) {
        return NextResponse.json({ products: [], done: true }, { status: 404 });
      }
      orgId = shop.id;
    }

    // Same function the page's first batch came from, so page two is ordered like
    // page one — a listing sorted one way on load and another on scroll would
    // interleave two orders in the same grid.
    const page = await productsDAL.getPage(
      {
        orgId,
        categorySlug: category,
        search: q,
        offerOnly: offers === "1",
      },
      { sort, offset, limit: PRODUCT_PAGE_SIZE },
    );

    return NextResponse.json(page);
  } catch (error) {
    return toErrorResponse(error, "Could not load more products");
  }
}
