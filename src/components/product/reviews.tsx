import { ReviewForm } from "@/components/product/review-form";
import { ReviewList } from "@/components/product/review-list";
import { ReviewSummary } from "@/components/product/review-summary";
import { SectionHeader } from "../shared/SectionHeader";
import { reviewsDAL } from "@/data-access-layer/reviews.dal";
import type { Product } from "@/domain/product";

/**
 * What buyers said about this piece, and the form to add to it (product-reviews R1–R5).
 *
 * A server component: the summary and the first page of reviews are read here and sent
 * as HTML, so they are in the first paint and in what a crawler sees. The two things
 * that need a browser — extending the list, and writing — are their own leaves.
 *
 * Until this existed the section said reviews "will appear here once we connect the
 * backend", while the rows sat in the table and every tile advertised 0.0.
 */
export async function Reviews({ product }: { product: Product }) {
  const page = await reviewsDAL.firstPage(product.id);
  const hasReviews = page.total > 0;

  return (
    <section
      id="reviews"
      className="space-y-4 rounded-xl border border-border/70 bg-card/80 p-4"
    >
      <SectionHeader
        overline="Bazaar whispers"
        title="Customer reviews"
        description={
          hasReviews
            ? "What buyers say about fit, fabric and colour."
            : undefined
        }
      />

      {hasReviews ? (
        <>
          <ReviewSummary summary={page.summary} />
          <ReviewList
            productId={product.id}
            initial={page.reviews}
            initiallyHasMore={page.hasMore}
            total={page.total}
          />
        </>
      ) : (
        // R5: an empty panel tells a shopper nothing. This asks.
        <p className="text-small text-muted-foreground">
          No reviews yet. If you have this piece, yours would be the first — how it
          fits and how the fabric feels is what the next buyer is trying to find out.
        </p>
      )}

      <div className="space-y-2">
        <h3 className="font-heading text-small font-semibold">
          {hasReviews ? "Write a review" : "Be the first to review it"}
        </h3>
        <ReviewForm productId={product.id} />
      </div>
    </section>
  );
}
