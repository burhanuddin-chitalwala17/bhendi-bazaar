import { ReviewStars } from "@/components/product/review-stars";
import type { BrandProof } from "@server/catalog/storefront.types";

/**
 * The compact stats under the tagline (brand-page R1, R3, R4): the rating with its count and
 * the orders fulfilled, each already cut off at its floor where the DTO was built
 * (`server/catalog/brand-page-proof.ts`, D3), so this draws what it is given and decides
 * nothing. Since-when stays on the hero's facts line, where a shop with no other proof
 * still has it. With nothing to show the strip is absent — a hero without proof closes up.
 *
 * The rating is the product page's own `ReviewStars`, whose label already says "rated 4.6
 * out of 5 from 23 reviews"; the visible count beside it is hidden from that reading so a
 * screen reader hears one sentence, not two.
 */
export function ProofStrip({ proof }: { proof: BrandProof | null }) {
  if (!proof) return null;
  const { rating, ordersFulfilled } = proof;
  if (!rating && ordersFulfilled === null) return null;

  return (
    <ul className="flex gap-2 sm:gap-3" aria-label="Why buyers trust this shop">
      {rating && (
        <li className="flex flex-1 flex-wrap items-center justify-center gap-x-1 gap-y-0.5 rounded-card border border-border bg-card px-3 py-2">
          <ReviewStars value={rating.average} count={rating.count} />
          <span aria-hidden className="text-2xs text-muted-foreground sm:text-xs">
            {" "}· {rating.count} reviews
          </span>
        </li>
      )}
      {ordersFulfilled !== null && (
        <li className="flex flex-1 items-center justify-center rounded-card border border-border bg-card px-3 py-2">
          <p className="text-2xs text-muted-foreground sm:text-xs">
            <span className="font-heading text-lg font-semibold text-foreground">
              {ordersFulfilled.toLocaleString("en-IN")}
            </span>{" "}
            orders fulfilled
          </p>
        </li>
      )}
    </ul>
  );
}
