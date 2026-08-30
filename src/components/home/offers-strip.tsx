import Link from "next/link";
import { PriceDisplay } from "../shared/PriceDisplay";
import { Product } from "@/domain/product";

export async function OffersStrip({ offers }: { offers: Product[] }) {
  if (!offers?.length) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-dashed border-accent bg-gradient-to-r from-accent/15 via-accent/5 to-primary/10 px-3 py-2.5 text-warning sm:px-4 sm:py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <span className="w-fit shrink-0 rounded-full bg-accent px-2.5 py-1 text-4xs font-semibold uppercase tracking-eyebrow text-accent-foreground shadow-raised sm:px-3 sm:text-2xs sm:tracking-eyebrow-wide">
          Ongoing Offers
        </span>
        {/* A rail, not a wrap: four offers wrapping on a phone push the rest of the
            page down by three rows for a strip nobody reads top-to-bottom. */}
        <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 no-scrollbar sm:mx-0 sm:flex-1 sm:flex-wrap sm:gap-4 sm:overflow-visible sm:px-0">
          {offers.slice(0, 4).map((offer) => (
            <Link
              key={offer.id}
              href={`/product/${offer.slug}`}
              className="flex shrink-0 snap-start items-center gap-2 border-l border-accent/60 pl-3 text-2xs sm:text-2xs"
            >
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
    </section>
  );
}
