"use client";

import { useCallback, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ShareShopSheet } from "@/components/org/share/share-shop-sheet";
import { SHARE_COPY } from "@/components/org/share/share-copy";
import type { ShareSetup } from "@/components/org/share/useShareShop";
import type { ShareShop } from "@/lib/store-preview";
import { DoneToast } from "./home-leaves";
import { HOME_COPY } from "./home-copy";
import { PlanIcon } from "@/components/subscriptions/plan-icon";
import { FEATURE } from "@/components/subscriptions/features";

/**
 * Home's link with its Share (R10, D13). After the first product is saved, the toast offers Share
 * too: the shop has something live to send, and the sheet opens over Home.
 */
export function HomeShareLink({
  orgId,
  shop,
  setup,
  productToast,
}: {
  orgId: string;
  shop: ShareShop;
  setup: ShareSetup | null;
  /** "Product added · n of 5 done", when Home was reached by saving the first product. */
  productToast: string | null;
}) {
  const [open, setOpen] = useState(false);
  const openSheet = useCallback(() => setOpen(true), []);
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-card border border-border bg-card p-3">
      <Icon name="shop" size="md" tone="primary" />
      <div className="min-w-0 flex-1">
        <p className="text-caption text-muted-foreground">{HOME_COPY.shopLink}</p>
        <Link href={shop.path} target="_blank" className="block truncate text-small font-medium text-foreground underline-offset-4 hover:underline">
          {shop.url}
        </Link>
      </div>
      <ShareShopSheet
        orgId={orgId}
        shop={shop}
        setup={setup}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0">
            <PlanIcon feature={FEATURE.STOREFRONT} name="share" size="sm" />
            {SHARE_COPY.open}
          </Button>
        }
      />
      {productToast && <DoneToast message={productToast} actionLabel={SHARE_COPY.open} onAction={openSheet} />}
    </div>
  );
}
