import Link from "next/link";

import { cn } from "@/lib/utils";
import type { CardStyle, SectionVariant } from "@server/catalog/storefront-themes";
import type { StorefrontOfferDto } from "@server/promotions/storefront-offers";
import { CopyCode } from "./copy-code";
import type { DealsSlice } from "./page-data";
import { SectionHeading, dealsHref } from "./section-heading";
import { RAIL_ITEM } from "./shelf";
import { ThemedProductCard } from "./themed-product-card";

const SHOP_THE_DEAL = "Shop the deal";

/**
 * The shop's offers and the goods they reduce (R7; Q12, Q13, Q20). Every word on a card is
 * promotions' derived copy and every price is the card's resolved one, so nothing here can
 * promise a figure checkout would refuse (ADR-0018). Three variants over one slice (Q8).
 */
export function ThemedDeals({
  variant,
  handle,
  offers,
  products,
  cardStyle,
  columns,
}: DealsSlice & { variant: SectionVariant<"deals">; cardStyle: CardStyle; columns: 2 | 3 }) {
  const href = dealsHref(handle);
  return (
    <section className="mx-auto max-w-store space-y-6 px-gutter py-section">
      <SectionHeading title="Deals" action={offers.length ? undefined : { label: SHOP_THE_DEAL, href }} />
      {offers.length > 0 && (
        <ul
          className={cn(
            variant === "campaign" && "grid gap-grid md:grid-cols-2",
            variant === "banners" && "no-scrollbar -mx-gutter flex snap-x gap-grid overflow-x-auto px-gutter",
            variant === "strip" && "no-scrollbar -mx-gutter flex gap-grid overflow-x-auto px-gutter",
          )}
        >
          {offers.map((offer, index) => (
            <li
              key={offer.id}
              className={cn(
                variant === "campaign" && index === 0 && "md:col-span-2",
                variant === "banners" && "w-[85%] shrink-0 snap-start md:w-[45%] lg:w-[32%]",
                variant === "strip" && "shrink-0",
              )}
            >
              <OfferCard offer={offer} href={href} variant={variant} lead={index === 0} />
            </li>
          ))}
        </ul>
      )}
      {products.length > 0 && (
        <ul aria-label="On offer" className="no-scrollbar -mx-gutter flex snap-x gap-grid overflow-x-auto px-gutter">
          {products.map((p) => (
            <li key={p.id} className={cn("shrink-0 snap-start", RAIL_ITEM[columns].width)}>
              <ThemedProductCard product={p} shopHandle={handle} cardStyle={cardStyle} sizes={RAIL_ITEM[columns].sizes} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OfferCard({
  offer,
  href,
  variant,
  lead,
}: {
  offer: StorefrontOfferDto;
  href: string;
  variant: SectionVariant<"deals">;
  lead: boolean;
}) {
  const strip = variant === "strip";
  return (
    <article
      data-offer={offer.id}
      className={cn(
        "flex h-full flex-col gap-2 rounded-card",
        variant === "campaign" && lead && "bg-feature p-6 text-feature-foreground",
        variant === "campaign" && !lead && "border border-border p-4",
        variant === "banners" && "bg-deal p-4 text-deal-foreground",
        strip && "rounded-field border border-border px-4 py-2",
      )}
    >
      <p className="font-label text-tag uppercase tracking-tag">{offer.title}</p>
      <p className={cn("break-words", lead && variant === "campaign" ? "font-display text-title" : "text-body font-semibold")}>
        {offer.headline}
      </p>
      <p className="text-tag">
        {offer.ends}
        {offer.fewLeft && <span className="font-label uppercase tracking-tag"> · Few left</span>}
      </p>
      <div className={cn("mt-auto flex flex-wrap items-center gap-3", strip && "mt-0")}>
        {offer.code && <CopyCode code={offer.code} />}
        <Link href={href} prefetch={false} className="font-label text-tag uppercase tracking-tag underline underline-offset-4">
          {SHOP_THE_DEAL}
        </Link>
      </div>
    </article>
  );
}
