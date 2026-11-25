"use client";

import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";
import { useOpenCheckoutLink } from "./useOpenCheckoutLink";
import { CHECKOUT_LINK_COPY } from "./checkout-link-copy";

/** Checkout's skeleton while a link's items are added (ux.md: Loading). */
export function CheckoutLinkOpener({ shop, token }: { shop: string; token: string }) {
  useOpenCheckoutLink(shop, token);
  return (
    <div className="space-y-6" aria-busy="true" aria-label={CHECKOUT_LINK_COPY.opening}>
      <SkeletonHeader description={false} />
      <SkeletonRows count={3} thumbnail={false} />
    </div>
  );
}
