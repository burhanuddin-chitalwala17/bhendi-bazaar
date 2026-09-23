import Link from "next/link";
import { Star } from "lucide-react";

import { orgReviewsDAL } from "@/data-access-layer/org/reviews.dal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Reviews",
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
      <div>
        <h1 className="text-3xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          What buyers say about your products. Moderation is handled by the
          platform.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
          No reviews yet.
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
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="h-4 w-4 fill-warning text-warning" />
                        {review.rating}
                      </span>
                    </div>
                    {review.title && (
                      <p className="mt-1 text-sm font-medium">{review.title}</p>
                    )}
                    {review.comment && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {review.comment}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {review.reviewerName} ·{" "}
                        {new Date(review.createdAt).toLocaleDateString("en-IN")}
                      </p>
                      {review.isVerified && (
                        <Badge variant="secondary">Verified purchase</Badge>
                      )}
                      {/* Reviews publish on write, so an unpublished one was taken
                          down — never "awaiting" anything (R15). */}
                      {review.isWithdrawn && (
                        <Badge variant="destructive">
                          Withdrawn by the platform
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
              aria-label="Reviews pages"
            >
              <Button
                variant="outline"
                disabled={pagination.page <= 1}
                asChild={pagination.page > 1}
              >
                {pagination.page > 1 ? (
                  <Link href={`?page=${pagination.page - 1}`}>Previous</Link>
                ) : (
                  <span>Previous</span>
                )}
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                asChild={pagination.page < pagination.totalPages}
              >
                {pagination.page < pagination.totalPages ? (
                  <Link href={`?page=${pagination.page + 1}`}>Next</Link>
                ) : (
                  <span>Next</span>
                )}
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
