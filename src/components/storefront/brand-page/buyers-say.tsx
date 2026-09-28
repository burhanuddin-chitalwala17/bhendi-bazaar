import Link from "next/link";

import { ReviewStars } from "@/components/product/review-stars";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { Badge } from "@/components/ui/badge";
import type { BuyersSaySlice } from "./sections";

/**
 * The shop's newest published reviews, as the product pages show them (brand-page R1, A3a):
 * stars, the frozen author name, the verified mark the store awarded, a line or two of what
 * was said, and the piece it was said about. The same `ReviewStars` and `Badge` as the
 * product page, so a buyer moving between the two reads one vocabulary.
 *
 * Text is text (R9): the comment is clamped by CSS and wraps, so a pasted script or a very
 * long unbroken string changes nothing about the layout and executes nothing.
 */
export function BuyersSay({ reviews }: BuyersSaySlice) {
  return (
    <section className="space-y-3">
      <SectionHeader overline="The shop" title="What buyers say" />
      <ul className="grid gap-3 md:grid-cols-3">
        {reviews.map((review) => (
          <li
            key={review.id}
            className="space-y-2 rounded-card border border-border/70 bg-card/60 p-3"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <ReviewStars value={review.rating} size="xs" />
              <p className="text-2xs font-medium sm:text-xs">{review.authorName}</p>
              {review.isVerifiedPurchase && (
                <Badge variant="secondary" className="text-4xs sm:text-3xs">
                  Verified purchase
                </Badge>
              )}
            </div>
            {review.comment && (
              <p className="line-clamp-2 break-words text-sm leading-relaxed text-foreground/90">
                {review.comment}
              </p>
            )}
            <p className="text-2xs text-muted-foreground">
              On{" "}
              <Link
                href={`/product/${review.product.slug}`}
                prefetch={false}
                className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                {review.product.name}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
