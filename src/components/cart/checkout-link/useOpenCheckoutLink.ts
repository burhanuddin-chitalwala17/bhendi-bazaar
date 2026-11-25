"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { checkoutLinkApiClient } from "./checkoutLinkApiClient";
import { ROUTES } from "@server/shared/routes";

/**
 * Open a checkout link once the saved cart has been read, add what it brings, and go on to
 * checkout (checkout-links D3). Adding before the read would be overwritten by it. When nothing
 * could be added, the names of what is gone come back instead and the page stays (ux.md: All out of stock).
 */
export function useOpenCheckoutLink(shop: string, token: string, sizes: readonly string[]) {
  const router = useRouter();
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const addFromLink = useCartStore((state) => state.addFromLink);
  const started = useRef(false);
  const [allOutOfStock, setAllOutOfStock] = useState<string[] | null>(null);

  useEffect(() => {
    if (!hasHydrated || started.current) return;
    started.current = true;
    checkoutLinkApiClient
      .open(shop, token, sizes)
      .then((result) => {
        if (result.kind === "unknown") return router.replace(ROUTES.store(shop));
        if (result.kind === "expired") {
          return router.replace(result.productSlug ? ROUTES.productFromExpiredLink(result.productSlug) : ROUTES.store(shop));
        }
        if (!result.alreadyOpened && result.lines.length === 0 && result.leftOut.length > 0) {
          return setAllOutOfStock(result.leftOut.map((item) => item.productName));
        }
        if (!result.alreadyOpened) addFromLink(result.linkId, result.lines);
        router.replace(ROUTES.checkout);
      })
      // Refused or unreachable: the shop's page, as for a link that opens nothing (decisions Q4).
      .catch(() => router.replace(ROUTES.store(shop)));
  }, [hasHydrated, shop, token, sizes, addFromLink, router]);

  return { allOutOfStock };
}
