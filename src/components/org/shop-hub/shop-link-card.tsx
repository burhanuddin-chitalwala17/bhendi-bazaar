"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { ShareShopSheet } from "@/components/org/share/share-shop-sheet";
import { SHARE_COPY } from "@/components/org/share/share-copy";
import { COPY_STATE, useShareShop } from "@/components/org/share/useShareShop";
import { SHOP_HUB_COPY, truncateMiddle } from "@/components/org/shop-hub/shop-hub-copy";
import type { ShareShop } from "@/lib/store-preview";
import { PlanIcon } from "@/components/subscriptions/plan-icon";
import { FEATURE } from "@/components/subscriptions/features";

/** The Shop tab's link card (own-store onboarding D3, D13): the link, Share, Copy link, See as a buyer. */
export function ShopLinkCard({ orgId, shop }: { orgId: string; shop: ShareShop }) {
  const { copyLink, copyState } = useShareShop(orgId, shop.url, null);
  const shown = shop.url.replace(/^https?:\/\//, "");

  return (
    <section className="space-y-3 rounded-card border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{SHOP_HUB_COPY.linkLabel}</p>
      <p className="select-all break-all font-medium text-foreground" title={shown}>
        {truncateMiddle(shown, 44)}
      </p>
      {copyState === COPY_STATE.FAILED && <p className="text-sm text-muted-foreground">{SHARE_COPY.copyFailed}</p>}
      <div className="flex flex-wrap gap-2">
        <ShareShopSheet
          orgId={orgId}
          shop={shop}
          setup={null}
          trigger={
            <Button type="button" size="lg" className="min-h-11">
              <PlanIcon feature={FEATURE.STOREFRONT} name="share" />
              {SHARE_COPY.open}
            </Button>
          }
        />
        <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={() => void copyLink()}>
          <Icon name="copy" />
          {SHARE_COPY.copyLink}
        </Button>
        <Button asChild variant="ghost" size="lg" className="min-h-11">
          <Link prefetch={false} href={shop.path} target="_blank" rel="noopener noreferrer">
            <Icon name="external" />
            {SHARE_COPY.seeAsBuyer}
          </Link>
        </Button>
      </div>
    </section>
  );
}
