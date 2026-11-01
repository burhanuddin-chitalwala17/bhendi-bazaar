"use client";

import Link from "next/link";
import { Copy, ExternalLink, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShareShopSheet } from "@/components/org/share/share-shop-sheet";
import { SHARE_COPY } from "@/components/org/share/share-copy";
import { COPY_STATE, useShareShop } from "@/components/org/share/useShareShop";
import { SHOP_HUB_COPY, truncateMiddle } from "@/components/org/shop-hub/shop-hub-copy";
import type { ShareShop } from "@/lib/store-preview";

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
              <Share2 aria-hidden />
              {SHARE_COPY.open}
            </Button>
          }
        />
        <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={() => void copyLink()}>
          <Copy aria-hidden />
          {SHARE_COPY.copyLink}
        </Button>
        <Button asChild variant="ghost" size="lg" className="min-h-11">
          <Link prefetch={false} href={shop.path} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {SHARE_COPY.seeAsBuyer}
          </Link>
        </Button>
      </div>
    </section>
  );
}
