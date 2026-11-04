"use client";

import { StorefrontIdentity } from "@/components/storefront/storefront-identity";
import { BrandStory } from "@/components/storefront/brand-page/brand-story";
import { brandOwnerFrom } from "@server/catalog/brand-page-sections";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import { SHOP_DETAILS_COPY } from "./shop-details-copy";

/**
 * The `lg:` live preview (org-profile D10, Q24): the storefront's own header and about blocks,
 * fed what the form holds now. Never an iframe — every response sends `frame-ancestors 'none'`.
 */
export function ShopPreview({ details }: { details: ShopDetailsDto }) {
  const owner = brandOwnerFrom(details);
  return (
    <div aria-label={SHOP_DETAILS_COPY.preview} className="space-y-6 rounded-card border border-border bg-background p-4">
      <StorefrontIdentity shop={details} />
      {details.location && (
        <p className="text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground">{details.location}</p>
      )}
      {(details.about || owner) && <BrandStory name={details.name} about={details.about} owner={owner} />}
    </div>
  );
}
