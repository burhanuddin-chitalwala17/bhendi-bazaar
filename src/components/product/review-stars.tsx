import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { STAR_VALUES } from "@server/catalog/review.types";

/**
 * A rating, read-only.
 *
 * No `"use client"`: five icons and a number need no browser, so this renders inside the
 * product page's own server pass wherever a rating appears — the summary, each review,
 * the tile.
 *
 * The number is always beside the stars rather than implied by them. Rounding to the
 * nearest whole star is how 4.4 and 4.6 look identical, and a shopper comparing two
 * pieces is entitled to the difference.
 */
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
          <Star
            key={star}
            className={cn(
              size === "xs" ? "size-3" : "size-4",
              star <= filled
                ? "fill-warning text-warning"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      <span
        aria-hidden
        className={cn(
          "font-medium tabular-nums",
          size === "xs" ? "text-4xs" : "text-2xs sm:text-xs",
        )}
      >
        {value.toFixed(1)}
      </span>
    </span>
  );
}
