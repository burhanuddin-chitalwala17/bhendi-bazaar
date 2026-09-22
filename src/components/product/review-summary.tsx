import { ReviewStars } from "@/components/product/review-stars";
import { STAR_VALUES, type ProductRating } from "@server/catalog/review.types";

/**
 * What the reviews add up to, above the list (product-reviews R2).
 *
 * The average and the bars answer different questions on purpose: the average is per
 * shopper — one voice however many times they wrote (R10) — and the bars count reviews,
 * so they sum to the number beside them and to the length of the list below. A page
 * where those two disagreed silently would be worse than one that shows both honestly.
 */
export function ReviewSummary({ summary }: { summary: ProductRating }) {
  const { average, count, histogram } = summary;
  return (
    <div className="space-y-3 sm:flex sm:items-start sm:gap-6 sm:space-y-0">
      <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
        <p className="font-heading text-2xl font-semibold leading-none tabular-nums">
          {average.toFixed(1)}
        </p>
        <div className="space-y-0.5">
          <ReviewStars value={average} count={count} />
          <p className="text-3xs text-muted-foreground sm:text-2xs">
            {count === 1 ? "1 review" : `${count} reviews`}
          </p>
        </div>
      </div>

      {/* Highest star first: a shopper scans for how many people loved it before how
          many did not, and the bars read as a distribution rather than a table. */}
      <ul className="w-full space-y-1 sm:max-w-xs">
        {[...STAR_VALUES].reverse().map((star) => {
          const forStar = histogram[star];
          const share = count === 0 ? 0 : (forStar / count) * 100;
          return (
            <li key={star} className="flex items-center gap-2 text-3xs sm:text-2xs">
              <span className="w-3 text-right tabular-nums text-muted-foreground">
                {star}
              </span>
              <span
                aria-hidden
                className="h-1.5 flex-1 overflow-hidden rounded-field bg-muted"
              >
                <span
                  className="block h-full rounded-field bg-warning"
                  // The one inline style here: a percentage is data, and a Tailwind
                  // class per possible width is not a scale, it is a hundred classes.
                  style={{ width: `${share}%` }}
                />
              </span>
              <span className="w-6 tabular-nums text-muted-foreground">
                {forStar}
              </span>
              <span className="sr-only">
                {forStar === 1 ? "1 review" : `${forStar} reviews`} at {star}{" "}
                {star === 1 ? "star" : "stars"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
