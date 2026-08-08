import { PriceDisplay } from "../shared/PriceDisplay";
import { Product } from "@/domain/product";

export async function OffersStrip({ offers }: { offers: Product[] }) {

  return (
    <section className="overflow-hidden rounded-xl border border-dashed border-accent bg-gradient-to-r from-accent/15 via-accent/5 to-primary/10 px-4 py-3 text-xs text-warning">
      <div className="flex flex-wrap items-center gap-4">
        <span className="rounded-full bg-accent px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-accent-foreground shadow-sm">
          Ongoing Offers
        </span>
        <div className="flex flex-1 flex-wrap gap-4">
          {offers?.slice(0, 4).map((offer) => (
            <div
              key={offer.id}
              className="flex items-center gap-2 border-l border-accent/60 pl-3 text-[0.7rem]"
            >
              <span className="font-medium uppercase tracking-[0.18em]">
                {offer.name}
              </span>
              {offer.salePrice && (
                <PriceDisplay price={offer.price} salePrice={offer.salePrice} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
