import type { AdminReview } from "@/domain/admin";
import { Star } from "lucide-react";

/** The one place the three states are named, so the table and the panel cannot disagree. */
export function stateOf(review: AdminReview) {
  if (review.deletedAt) {
    return {
      label: "Deleted by author",
      variant: "outline" as const,
      // The author's own act. Restoring it would republish words someone took back.
      moderable: false,
    };
  }
  if (review.withdrawnAt) {
    return { label: "Withdrawn", variant: "destructive" as const, moderable: true };
  }
  return { label: "Published", variant: "secondary" as const, moderable: true };
}

export const Stars = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        aria-hidden
        className={
          star <= rating ? "size-4 fill-warning text-warning" : "size-4 text-muted-foreground/50"
        }
      />
    ))}
  </span>
);
