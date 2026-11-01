import Link from "next/link";

import { RefreshButton } from "@/components/channel/refresh-button";
import { ReviewMedia } from "@/components/product/review-media";
import { ReviewStars } from "@/components/product/review-stars";
import { ReviewSummary } from "@/components/product/review-summary";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/format";
import type { ReviewPageDto } from "@server/catalog/review.types";

/** The id Home's "new reviews" line scrolls to (own-store onboarding D12). */
export const PRODUCT_REVIEWS_ANCHOR = "reviews";

export const PRODUCT_REVIEWS_COPY = {
  title: "Reviews",
  none: "No reviews yet. They appear after buyers receive orders.",
  failed: "Couldn't load. Try again.",
  tryAgain: "Try again",
  seeAll: "See all reviews",
  verified: "Verified purchase",
} as const;

export type ProductReviewsRead = { ok: true; page: ReviewPageDto } | { ok: false };

/**
 * What buyers said about this product, on its portal page (own-store onboarding R9, D12; Q13), newest
 * first. Read-only: a shop neither edits nor answers a review (replies are parked).
 */
export function ProductReviewsSection({ read, allReviewsHref }: { read: ProductReviewsRead; allReviewsHref: string }) {
  return (
    <section id={PRODUCT_REVIEWS_ANCHOR} className="scroll-mt-20 space-y-4 rounded-card border border-border bg-card p-4">
      <h2 className="font-heading text-lg font-semibold text-foreground">{PRODUCT_REVIEWS_COPY.title}</h2>
      {!read.ok ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">{PRODUCT_REVIEWS_COPY.failed}</p>
          <RefreshButton label={PRODUCT_REVIEWS_COPY.tryAgain} />
        </div>
      ) : read.page.total === 0 ? (
        <p className="text-sm text-muted-foreground">{PRODUCT_REVIEWS_COPY.none}</p>
      ) : (
        <>
          <ReviewSummary summary={read.page.summary} />
          <ul className="divide-y divide-border">
            {read.page.reviews.map((review) => (
              <li key={review.id} className="space-y-1 py-3">
                <ReviewStars value={review.rating} size="xs" />
                {review.title && <p className="text-sm font-medium text-foreground">{review.title}</p>}
                {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                <ReviewMedia media={review.media} authorName={review.authorName} />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {review.authorName} · {formatShortDate(review.createdAt)}
                  </span>
                  {review.isVerifiedPurchase && <Badge variant="secondary">{PRODUCT_REVIEWS_COPY.verified}</Badge>}
                </div>
              </li>
            ))}
          </ul>
          {read.page.hasMore && (
            <Link prefetch={false} href={allReviewsHref} className="inline-flex min-h-11 items-center text-sm font-medium text-primary">
              {PRODUCT_REVIEWS_COPY.seeAll}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

/** Holds the section's place while its read streams in after the rest of the page. */
export function ProductReviewsSkeleton() {
  return (
    <div id={PRODUCT_REVIEWS_ANCHOR} className="scroll-mt-20 space-y-3 rounded-card border border-border bg-card p-4" aria-busy="true">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}
