import { Icon } from "@/components/ui/icon";

import { cn } from "@/lib/utils";
import { STAR_VALUES } from "@server/catalog/review.types";

/** A rating, read-only, server-rendered; the number sits beside the stars, since rounding hides 4.4 vs 4.6. */
export function ReviewStars({
  value,
  count,
  size = "sm",
  className,
}: {
  value: number;
  /** How many reviews the value came from; omitted where the caller says it itself. */
  count?: number;
  size?: "xs" | "sm";
  className?: string;
}) {
  const filled = Math.round(value);
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      // One label for the whole group: a screen reader wants "rated 4.2 out of 5", not
      // five identical star announcements.
      role="img"
      aria-label={
        count === undefined
          ? `Rated ${value.toFixed(1)} out of 5`
          : `Rated ${value.toFixed(1)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`
      }
    >
      <span aria-hidden className="inline-flex items-center gap-px">
        {STAR_VALUES.map((star) => (
          <Icon key={star} name="rating" size={size === "xs" ? "xs" : "sm"} filled={star <= filled} tone={star <= filled ? "warning" : "muted"} />
        ))}
      </span>
      <span
        aria-hidden
        className={cn(
          "font-medium tabular-nums",
          size === "xs" ? "text-caption" : "text-small",
        )}
      >
        {value.toFixed(1)}
      </span>
    </span>
  );
}
