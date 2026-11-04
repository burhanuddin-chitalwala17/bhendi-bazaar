import { orgReviewsDAL } from "@/data-access-layer/org/reviews.dal";
import { ReviewMedia } from "@/components/product/review-media";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { formatShortDate } from "@/lib/format";
import { ORG_REVIEWS_COPY } from "../org-console-copy";

interface Props {
  orgId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function AdminOrgReviews({ orgId, searchParams }: Props) {
  const params = await searchParams;
  const page = Array.isArray(params.page) ? params.page[0] : params.page;
  const { reviews, pagination } = await orgReviewsDAL.getReviews(
    orgId,
    Number(page) || 1,
  );

  if (reviews.length === 0) {
    return (
      <EmptyState
        title={ORG_REVIEWS_COPY.empty}
        description={ORG_REVIEWS_COPY.emptyHint}
      />
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <span className="sr-only">{ORG_REVIEWS_COPY.rated(review.rating)}</span>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon
                    key={i}
                    name="rating"
                    filled={i < review.rating}
                    tone={i < review.rating ? "warning" : "muted"}
                  />
                ))}
              </div>
              <span className="text-caption text-muted-foreground">
                {formatShortDate(review.createdAt)}
              </span>
            </div>
            {review.comment && (
              <p className="text-small">{review.comment}</p>
            )}
            <div className="flex items-center gap-2 text-caption text-muted-foreground">
              <span>{review.reviewerName}</span>
              {review.isVerified && (
                <StatusBadge tone="success">{ORG_REVIEWS_COPY.verified}</StatusBadge>
              )}
              <span>{ORG_REVIEWS_COPY.on(review.product.name)}</span>
            </div>
            {review.media && review.media.length > 0 && (
              <ReviewMedia media={review.media} authorName={review.reviewerName} />
            )}
          </CardContent>
        </Card>
      ))}
      <p className="text-caption text-muted-foreground text-center">
        Page {pagination.page} of {pagination.totalPages} ({pagination.total} reviews)
      </p>
    </div>
  );
}
