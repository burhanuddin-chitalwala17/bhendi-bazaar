import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SectionVariant } from "@server/catalog/storefront-themes";
import type { ReviewsSlice } from "./page-data";
import { SectionHeading, storefrontProductHref } from "./section-heading";
import { THEMED_COPY } from "./themed-copy";

/**
 * What buyers said, as quotes or one highlighted (Q8). Under the rating's floor the slice is
 * null and the section absent (Q15); the frozen author name, never a user id.
 */
export function ThemedReviews({
  variant,
  handle,
  reviews,
}: ReviewsSlice & { variant: SectionVariant<"reviews"> }) {
  const shown = variant === "highlight" ? reviews.slice(0, 1) : reviews;
  return (
    <section className="mx-auto max-w-store space-y-4 px-gutter py-section">
      <SectionHeading title={THEMED_COPY.sections.reviews} />
      <ul className={cn("grid gap-grid", variant === "quotes" && "md:grid-cols-3")}>
        {shown.map((review) => (
          <li key={review.id} className={cn("space-y-2", variant === "highlight" ? "bg-feature p-6 text-feature-foreground" : "border-t border-border pt-4")}>
            <p className="font-label text-tag tracking-tag" aria-label={`Rated ${review.rating} out of 5`}>
              {"★".repeat(review.rating)}
            </p>
            {review.comment && (
              <blockquote
                className={cn(
                  "break-words",
                  variant === "highlight" ? "font-display text-title" : "line-clamp-4 text-body",
                )}
              >
                {review.comment}
              </blockquote>
            )}
            <p className="text-tag">
              {review.authorName} · on{" "}
              <Link href={storefrontProductHref(review.product.slug, handle)} prefetch={false} className="underline underline-offset-4">
                {review.product.name}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
