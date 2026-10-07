import { Star } from "lucide-react";
import { orgReviewsDAL } from "@/data-access-layer/org/reviews.dal";
import { ReviewMedia } from "@/components/product/review-media";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
      <p className="py-12 text-center text-sm text-muted-foreground">
        No reviews yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < review.rating ? "fill-warning text-warning" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString("en-IN")}
              </span>
            </div>
            {review.comment && (
              <p className="text-sm">{review.comment}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{review.reviewerName}</span>
              {review.isVerified && (
                <Badge variant="outline" className="text-2xs">Verified</Badge>
              )}
              <span>on {review.product.name}</span>
            </div>
            {review.media && review.media.length > 0 && (
              <ReviewMedia media={review.media} authorName={review.reviewerName} />
            )}
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground text-center">
        Page {pagination.page} of {pagination.totalPages} ({pagination.total} reviews)
      </p>
    </div>
  );
}
