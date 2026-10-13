"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ReviewForm } from "@/components/product/review-form";
import { ReviewMedia } from "@/components/product/review-media";
import { ReviewStars } from "@/components/product/review-stars";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reviewApiClient } from "@/components/product/reviewApiClient";
import type { ReviewDto } from "@server/catalog/review.types";
import { formatDay } from "@/lib/format";

/**
 * The reviews themselves, extending in place (product-reviews R3).
 *
 * The first page arrives from the server as `initial`, so the reviews are in the HTML a
 * shopper and a crawler both get; this component exists for what a browser must do —
 * appending later pages, and the author's own edit and delete (R9).
 *
 * A button rather than only an observer, for the same reason the product grid keeps one:
 * a shopper who never scrolls that element into view would otherwise think a product
 * has five reviews.
 */
export function ReviewList({
  productId,
  initial,
  initiallyHasMore,
  total,
}: {
  productId: string;
  initial: ReviewDto[];
  initiallyHasMore: boolean;
  total: number;
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initial);
  const [hasMore, setHasMore] = useState(initiallyHasMore);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReviewDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A submission, an edit or a withdrawal re-renders the server component, which hands
  // down a fresh first page. Anything this component had appended is stale at that
  // point, so it starts again from what the server now says rather than merging two
  // versions of the same list.
  useEffect(() => {
    setReviews(initial);
    setHasMore(initiallyHasMore);
    setPage(1);
  }, [initial, initiallyHasMore]);

  const readMore = async () => {
    setLoading(true);
    try {
      const next = await reviewApiClient.getPage(productId, page + 1);
      setReviews((current) => [...current, ...next.reviews]);
      setHasMore(next.hasMore);
      setPage((current) => current + 1);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load more reviews. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await reviewApiClient.remove(pendingDelete.id);
      toast.success("Your review is deleted");
      setPendingDelete(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete your review.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="space-y-2 rounded-card border border-border/70 bg-card/60 p-3"
          >
            {editingId === review.id ? (
              <ReviewForm
                productId={productId}
                editing={review}
                onDone={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <ReviewStars value={review.rating} size="xs" />
                  <p className="text-2xs font-medium sm:text-xs">
                    {review.authorName}
                  </p>
                  {review.isVerifiedPurchase && (
                    <Badge variant="secondary" className="text-4xs sm:text-3xs">
                      Verified purchase
                    </Badge>
                  )}
                  <time
                    dateTime={review.createdAt}
                    className="text-4xs text-muted-foreground sm:text-3xs"
                  >
                    {formatDay(review.createdAt)}
                  </time>
                </div>

                {review.title && (
                  <p className="font-heading text-2xs font-semibold sm:text-sm">
                    {review.title}
                  </p>
                )}
                {review.comment && (
                  <p className="whitespace-pre-line text-2xs leading-relaxed text-muted-foreground sm:text-sm">
                    {review.comment}
                  </p>
                )}

                {/* The reviewer's own pictures, inside their review and nowhere else
                    (review-media R7, R8). No separate description: their words are it
                    (R9), so the accessible name says whose photo it is. */}
                <ReviewMedia media={review.media} authorName={review.authorName} />

                {review.isMine && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(review.id)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setPendingDelete(review)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {hasMore && (
        <Button
          type="button"
          variant="outline"
          onClick={readMore}
          disabled={loading}
          className="w-full sm:w-auto"
        >
          {loading ? "Loading…" : `Read more reviews (${total - reviews.length} left)`}
        </Button>
      )}

      {/* A dialog rather than `confirm()`: deleting a review is irreversible and the
          sentence explaining that is worth formatting (the PR-115 precedent). */}
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>
              It comes off the product page and out of its rating. This cannot be
              undone — your other reviews of this piece are untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPendingDelete(null)}
            >
              Keep it
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
