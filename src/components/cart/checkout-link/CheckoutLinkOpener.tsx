"use client";

import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { ROUTES } from "@server/shared/routes";
import { useOpenCheckoutLink } from "./useOpenCheckoutLink";
import { CHECKOUT_LINK_COPY } from "./checkout-link-copy";

/** Checkout's skeleton while a link's items are added (ux.md: Loading), or that none could be (All out of stock). */
export function CheckoutLinkOpener({ shop, token, sizes }: { shop: string; token: string; sizes: string[] }) {
  const { allOutOfStock } = useOpenCheckoutLink(shop, token, sizes);
  if (allOutOfStock) {
    return (
      <EmptyState
        title={CHECKOUT_LINK_COPY.allOutOfStock}
        description={allOutOfStock.join(", ")}
        action={{ label: CHECKOUT_LINK_COPY.visitShop, href: ROUTES.store(shop) }}
      />
    );
  }
  return (
    <div className="space-y-6" aria-busy="true" aria-label={CHECKOUT_LINK_COPY.opening}>
      <SkeletonHeader description={false} />
      <SkeletonRows count={3} thumbnail={false} />
    </div>
  );
}
