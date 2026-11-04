import type { AdminReview } from "@/domain/admin";
import { Icon } from "@/components/ui/icon";
import type { StatusTone } from "@/components/shared/badges/StatusBadge";

/** The one place the three states are named, so the table and the panel cannot disagree. */
export function stateOf(review: AdminReview) {
  if (review.deletedAt) {
    return {
      label: "Deleted by author",
      tone: "neutral" as StatusTone,
      // The author's own act. Restoring it would republish words someone took back.
      moderable: false,
    };
  }
  if (review.withdrawnAt) {
    return { label: "Withdrawn", tone: "destructive" as StatusTone, moderable: true };
  }
  return { label: "Published", tone: "success" as StatusTone, moderable: true };
}

export const Stars = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Icon key={star} name="rating" filled={star <= rating} tone={star <= rating ? "warning" : "muted"} />
    ))}
  </span>
);
