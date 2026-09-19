import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PriceDisplay } from "../shared/PriceDisplay";
import { Product } from "@/domain/product";

/**
 * The offers rail: what is reduced right now, as a line rather than a grid.
 *
 * Each entry carries its thumbnail. A name and two numbers ask a shopper to recognise
 * a product from its SKU, which is a reading task; the picture is what makes the strip
 * scannable at a glance, and it is the same `thumbnail` the tile grid already uses so
 * there is no second image to fetch.
 *
 * Used by the marketplace home page and by a shop's own storefront, which passes its
 * own offers — the strip does not know or care which.
 */
/**
 * How many offers the strip shows.
 *
 * Declared here and imported by the pages that feed it, so the number the strip
 * renders and the number its callers fetch cannot disagree — a caller that fetched
 * four while the strip drew three would silently hide one and never offer a way to it.
 * Callers read one more than this, which is how they know whether to show the link.
 */
export const OFFERS_IN_STRIP = 3;

export async function OffersStrip({
  offers,
  viewAll,
}: {
  offers: Product[];
  /**
   * Where the rest of the offers are, when there are more than fit.
   *
   * Passed in rather than derived, because the two callers mean different things by
   * it: the marketplace sends a shopper to `/offers`, a whole page of everything
   * reduced; a shop keeps them where they are and narrows the grid below. Same strip,
   * same button, different promise — so the label comes with the destination.
   */
  viewAll?: { href: string; label: string };
}) {
  if (!offers?.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-dashed border-accent bg-gradient-to-r from-accent/15 via-accent/5 to-primary/10 px-3 py-2.5 text-warning sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <span className="w-fit shrink-0 rounded-full bg-accent px-2.5 py-1 text-4xs font-semibold uppercase tracking-eyebrow text-accent-foreground shadow-raised sm:px-3 sm:text-2xs sm:tracking-eyebrow-wide">
          Ongoing Offers
        </span>
        {/* A rail on a phone, a wrapping row from `sm:` — offers wrapping on a phone
            would push the page down by two rows for a strip nobody reads
            top-to-bottom. */}
        <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 no-scrollbar sm:mx-0 sm:flex-1 sm:flex-wrap sm:gap-4 sm:overflow-visible sm:px-0">
          {offers.slice(0, OFFERS_IN_STRIP).map((offer) => (
            <Link
              prefetch={false}
              key={offer.id}
              href={`/product/${offer.slug}`}
              className="flex shrink-0 snap-start items-center gap-2 border-l border-accent/60 pl-3 text-2xs sm:text-2xs"
            >
              <span className="relative size-6 shrink-0 overflow-hidden rounded-field bg-muted sm:size-7">
                <Image
                  src={offer.thumbnail}
                  alt=""
                  fill
                  // Honest about the slot (ADR-0026): a 28px box, nothing more. The
                  // strip is where overstating would be cheapest to do and most
                  // wasteful, since every offer in it loads at once.
                  sizes="28px"
                  className="object-cover"
                />
              </span>
              <span className="max-w-[10rem] truncate font-medium uppercase tracking-label sm:max-w-none sm:tracking-eyebrow">
                {offer.name}
              </span>
              {offer.salePrice && (
                <PriceDisplay
                  price={offer.price}
                  salePrice={offer.salePrice}
                  size="xs"
                  showBadge={false}
                />
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Its own row under the strip, pinned to the right. `ml-auto` with `w-fit` is
          what does it: this is a block-level child of the section, not a flex item, so
          `self-end` would be inert here — the link is itself `display:flex`, so without
          a width it stretches the full row and its contents sit at the left. */}
      {viewAll && (
        <Link
          prefetch={false}
          href={viewAll.href}
          className="ml-auto mt-1 flex w-fit items-center gap-1 text-2xs font-semibold uppercase tracking-label text-accent-foreground underline-offset-4 hover:underline sm:tracking-eyebrow"
        >
          {viewAll.label}
          <ChevronRight className="size-3" />
        </Link>
      )}
    </section>
  );
}
