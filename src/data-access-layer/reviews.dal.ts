import { cache } from "react";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { reviewService } from "@server/catalog/review.service";
import type { ReviewPageDto } from "@server/catalog/review.types";

/**
 * What the product page reads about its own reviews.
 *
 * A server read, not a fetch: the summary and the first page of reviews are in the HTML
 * the server already sends, so a shopper sees them in the first paint and a crawler
 * sees them at all. Only *extending* the list is a route handler, because that is
 * interaction-triggered (product-reviews R3, trd.md D13).
 */
export const reviewsDAL = {
  /** The first page, with `isMine` resolved against whoever is signed in (R9). */
  firstPage: cache(async (productId: string): Promise<ReviewPageDto> => {
    const session = await getServerSession(authOptions);
    return reviewService.getPage(productId, 1, session?.user?.id ?? null);
  }),

  /** Whether there is anyone to attribute a new review to (R7, R12). */
  viewerId: cache(async (): Promise<string | null> => {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
  }),
};
