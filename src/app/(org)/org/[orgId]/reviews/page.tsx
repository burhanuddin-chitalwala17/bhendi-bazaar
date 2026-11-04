import Link from "next/link";
import { Icon } from "@/components/ui/icon";

import { orgReviewsDAL } from "@/data-access-layer/org/reviews.dal";
import { ReviewMedia } from "@/components/product/review-media";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-shell";
import { formatShortDate } from "@/lib/format";
import { SHOP_REVIEWS_COPY } from "@/components/org/reviews-copy";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = {
  title: ORG_PAGE_TITLES.reviews,
  robots: { index: false, follow: false },
};

/**
 * What buyers said about this org's products (product-reviews R17).
 *
 * Read-only by design: an org sees a withdrawal happened, and cannot cause or undo
 * one. Reviews their authors retracted never reach this page at all.
 */
export default async function OrgReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { orgId } = await params;
  const { page } = await searchParams;
  const { reviews, pagination } = await orgReviewsDAL.getReviews(
    orgId,
    Number(page) || 1,
  );

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader help="reviews" title={SHOP_REVIEWS_COPY.title} description={SHOP_REVIEWS_COPY.description} />

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
          {SHOP_REVIEWS_COPY.empty}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{review.product.name}</span>
                      <span className="flex items-center gap-1 text-small">
                        <Icon name="rating" size="sm" filled tone="warning" />
                        {review.rating}
                      </span>
                    </div>
                    {review.title && (
                      <p className="mt-1 text-small font-medium">{review.title}</p>
                    )}
                    {review.comment && (
                      <p className="mt-1 text-small text-muted-foreground">
                        {review.comment}
                      </p>
                    )}
                    {/* The buyer's own photographs of your piece, in the same viewer a
                        buyer uses. Read-only like the rest of this page. */}
                    <div className="mt-2">
                      <ReviewMedia
                        media={review.media}
                        authorName={review.reviewerName}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {review.reviewerName} ·{" "}
                        {formatShortDate(review.createdAt)}
                      </p>
                      {review.isVerified && (
                        <Badge variant="secondary">{SHOP_REVIEWS_COPY.verified}</Badge>
                      )}
                      {/* Reviews publish on write, so an unpublished one was taken
                          down — never "awaiting" anything (R15). */}
                      {review.isWithdrawn && (
                        <Badge variant="destructive">
                          {SHOP_REVIEWS_COPY.withdrawn}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>

          {pagination.totalPages > 1 && (
            <nav
              className="flex items-center justify-between gap-2"
              aria-label={SHOP_REVIEWS_COPY.pages}
            >
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                asChild={pagination.page > 1}
              >
                {pagination.page > 1 ? (
                  <Link href={`?page=${pagination.page - 1}`}>{SHOP_REVIEWS_COPY.previous}</Link>
                ) : (
                  <span>{SHOP_REVIEWS_COPY.previous}</span>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                {SHOP_REVIEWS_COPY.pageOf(pagination.page, pagination.totalPages)}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                asChild={pagination.page < pagination.totalPages}
              >
                {pagination.page < pagination.totalPages ? (
                  <Link href={`?page=${pagination.page + 1}`}>{SHOP_REVIEWS_COPY.next}</Link>
                ) : (
                  <span>{SHOP_REVIEWS_COPY.next}</span>
                )}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
