import Image from "next/image";
import Link from "next/link";

import type { Product } from "@/domain/product";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockStatus } from "@/components/shared/StockStatus";
import { ShareButton } from "@/components/shared/ShareButton";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { ReviewStars } from "@/components/product/review-stars";
import { DeliveryCheck } from "@/components/product/delivery-check";
import { ProductBuyActions } from "@/components/product/product-buy-actions";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { ROUTES } from "@server/shared/routes";
import { PRODUCT_PAGE_COPY } from "./product-copy";

const label = (key: string) => key.replace(/-/g, " ");

/**
 * The product's words beside its photographs (StorePDP, StorePDPDesktop). A server component:
 * only the heart, share, delivery check and buy buttons are client leaves.
 */
/**
 * `orgStorefrontOpen` false draws the shop's name without the link: a locked storefront is
 * reachable from nowhere (subscriptions/feature-access Q7, Q27). The product itself is unchanged (Q8).
 */
export function ProductDetails({ orgStorefrontOpen = true, ...product }: Product & { orgStorefrontOpen?: boolean }) {
  const specs = [
    ...Object.entries(product.facts ?? {}).map(([key, value]) => [label(key), String(value)] as const),
    ...Object.entries(product.measurements ?? {}).map(([key, value]) => [label(key), `${value}"`] as const),
  ];

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        {/* Who sells it, and the way to everything else they sell (org-storefront R5). */}
        {orgStorefrontOpen ? (
          <Link
            href={ROUTES.store(product.org.handle)}
            prefetch={false}
            className="inline-flex min-h-10 items-center gap-1 text-small font-medium text-primary md:min-h-0"
          >
            {product.org.name}
            <Icon name="next" size="xs" />
          </Link>
        ) : (
          <p className="inline-flex min-h-10 items-center text-small font-medium text-muted-foreground md:min-h-0">{product.org.name}</p>
        )}
        <div className="flex items-start gap-1">
          <h1 className="min-w-0 flex-1 break-words font-display text-headline font-display-weight display-case text-foreground in-data-theme:tracking-headline">{product.name}</h1>
          <WishlistButton productId={product.id} className="shrink-0" />
          <ShareButton
            url={ROUTES.product(product.slug)}
            title={`${product.name} — Bhendi Bazaar`}
            text={`Look at this on Bhendi Bazaar: ${product.name}`}
            variant="ghost"
            size="lg"
            shape="icon"
            className="shrink-0"
          />
        </div>
        {/* Derived counts (product-reviews R6a); with none, the line asks rather than showing 0.0. */}
        {product.reviewsCount > 0 ? (
          <Link href="#reviews" className="inline-flex min-h-10 items-center gap-1.5 text-small md:min-h-0">
            <ReviewStars value={product.rating} count={product.reviewsCount} size="xs" />
            <span className="text-muted-foreground underline-offset-2 hover:underline">
              {PRODUCT_PAGE_COPY.details.reviewCount(product.reviewsCount)}
            </span>
          </Link>
        ) : (
          <Link href="#reviews" className="inline-flex min-h-10 items-center text-small text-muted-foreground underline-offset-2 hover:underline md:min-h-0">
            {PRODUCT_PAGE_COPY.details.noReviews}
          </Link>
        )}
      </div>

      <div className="space-y-1">
        <PriceDisplay price={product.price} salePrice={product.salePrice} size="lg" />
        <p className="text-caption text-muted-foreground">{PRODUCT_PAGE_COPY.details.inclusiveOfTaxes}</p>
        <StockStatus stock={product.stock} lowStockThreshold={product.lowStockThreshold} variant="warn-only" />
      </div>

      {product.siblings && product.siblings.length > 1 && (
        <div className="space-y-2">
          <p className="text-label uppercase text-muted-foreground">{PRODUCT_PAGE_COPY.details.alsoAvailable}</p>
          <ul className="flex flex-wrap gap-2">
            {product.siblings.map((sibling) => (
              <li key={sibling.slug}>
                <Link
                  href={ROUTES.product(sibling.slug)}
                  prefetch={false}
                  aria-current={sibling.isCurrent ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-field border px-2 py-1.5 text-small transition-colors duration-fast",
                    sibling.isCurrent ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-primary/40",
                  )}
                >
                  <Image src={sibling.thumbnail} alt="" width={32} height={32} sizes="32px" className="size-8 rounded-field object-cover" />
                  <span className="max-w-28 truncate">{sibling.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Inline from a tablet up; on a phone the same actions dock above the tab bar (the page's ActionBar). */}
      <ProductBuyActions product={product} className="hidden md:flex" />

      {/* One card, a row each, ruled between (StorePDP): delivery, payment, returns. */}
      <ul className="divide-y divide-border rounded-card border border-border bg-card px-4">
        {product.shippingFromPincode && (
          <li className="py-3">
            <DeliveryCheck fromPincode={product.shippingFromPincode} weight={product.weight} />
          </li>
        )}
        <li className="flex min-h-12 items-center gap-3 text-small">
          <Icon name="secure" size="md" />
          {PRODUCT_PAGE_COPY.details.payBy}
        </li>
        <li className="flex min-h-12 items-center gap-3 text-small">
          <Icon name="returns" size="md" />
          <Link href={ROUTES.policy("returns")} prefetch={false} className="underline-offset-2 hover:underline">
            {PRODUCT_PAGE_COPY.details.returns}
          </Link>
        </li>
      </ul>

      {(product.description || specs.length > 0) && (
        <div className="space-y-3">
          <h2 className="font-display text-title font-display-weight display-case">{PRODUCT_PAGE_COPY.details.heading}</h2>
          {product.description && <p className="whitespace-pre-line text-body text-muted-foreground">{product.description}</p>}
          {specs.length > 0 && (
            <dl className="grid grid-cols-1 gap-x-6 divide-y divide-border md:grid-cols-2 md:divide-y-0">
              {specs.map(([term, value]) => (
                <div key={term} className="flex justify-between gap-4 py-2 text-small">
                  <dt className="capitalize text-muted-foreground">{term}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-small text-muted-foreground">
        <Icon name="help" size="md" />
        <span>{PRODUCT_PAGE_COPY.details.questions}</span>
        <ContactLauncher className="h-auto min-h-10 px-0 text-small font-medium text-primary hover:bg-transparent">{PRODUCT_PAGE_COPY.details.contactUs}</ContactLauncher>
      </div>
    </section>
  );
}
