import { orgReviewsDAL } from "@/data-access-layer/org/reviews.dal";
import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Reviews", robots: { index: false, follow: false } };

export default async function OrgReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { orgId } = await params;
  const { page } = await searchParams;
  const { reviews } = await orgReviewsDAL.getReviews(orgId, Number(page) || 1);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          What buyers say about your products. Moderation is handled by the platform.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-muted-foreground">
          No reviews yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <Card><CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{review.product.name}</span>
                <span className="flex items-center gap-1 text-sm">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  {review.rating}
                </span>
              </div>
              {review.comment && (
                <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                {review.reviewerName} · {new Date(review.createdAt).toLocaleDateString("en-IN")}
                {!review.isApproved && " · awaiting moderation"}
              </p>
              </CardContent></Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
