import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { PriceDisplay } from "../shared/PriceDisplay";
import { Product } from "@/domain/product";

/** How many offers the strip shows; callers read one more to know whether to offer the rest. */
export const OFFERS_IN_STRIP = 3;

/** What is reduced right now, as a line with thumbnails, used by the marketplace home and a shop's storefront. */
export async function OffersStrip({
  offers,
  viewAll,
}: {
  offers: Product[];
  /** Where the rest are; the caller names it, since a shop keeps buyers on its own page. */
  viewAll?: { href: string; label: string };
}) {
  if (!offers?.length) return null;

  return (
    <section aria-label="On offer" className="rounded-card border border-border bg-card px-3 py-3 md:px-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <p className="inline-flex shrink-0 items-center gap-2 text-small font-semibold text-foreground">
          <Icon name="offer" size="md" tone="deal" />
          On offer now
        </p>
        <div className="-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 no-scrollbar md:mx-0 md:flex-1 md:px-0">
          {offers.slice(0, OFFERS_IN_STRIP).map((offer) => (
            <Link
              prefetch={false}
              key={offer.id}
              href={`/product/${offer.slug}`}
              className="flex min-h-10 shrink-0 snap-start items-center gap-2"
            >
              <span className="relative size-10 shrink-0 overflow-hidden rounded-field bg-muted">
                {/* Honest about the 40px slot (ADR-0026): every offer in the strip loads at once. */}
                <Image src={offer.thumbnail} alt="" fill sizes="40px" className="object-cover" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="max-w-40 truncate text-caption text-foreground">{offer.name}</span>
                {offer.salePrice && (
                  <PriceDisplay price={offer.price} salePrice={offer.salePrice} size="xs" showBadge={false} />
                )}
              </span>
            </Link>
          ))}
        </div>
        {viewAll && (
          <Link
            prefetch={false}
            href={viewAll.href}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 self-end text-small font-medium text-primary underline-offset-4 hover:underline md:self-auto"
          >
            {viewAll.label}
            <Icon name="next" size="sm" />
          </Link>
        )}
      </div>
    </section>
  );
}
