"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/shared/ShareButton";
import { useShare } from "@/hooks/core/useShare";
import { SHOP_HUB_COPY, truncateMiddle } from "@/components/org/shop-hub/shop-hub-copy";

/** The Shop tab's link card (own-store onboarding D3): the link, Share, Copy link, See as a buyer. */
export function ShopLinkCard({ url, path, shopName }: { url: string; path: string; shopName: string }) {
  const { copyToClipboard } = useShare();
  const [copyFailed, setCopyFailed] = useState(false);
  const shown = url.replace(/^https?:\/\//, "");

  const copy = async () => {
    const ok = await copyToClipboard(url);
    setCopyFailed(!ok);
    if (ok) toast.success(SHOP_HUB_COPY.copied);
  };

  return (
    <section className="space-y-3 rounded-card border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{SHOP_HUB_COPY.linkLabel}</p>
      <p className="select-all break-all font-medium text-foreground" title={shown}>
        {truncateMiddle(shown, 44)}
      </p>
      {copyFailed && <p className="text-sm text-muted-foreground">{SHOP_HUB_COPY.copyFailed}</p>}
      <div className="flex flex-wrap gap-2">
        <ShareButton url={url} title={shopName} text={`Visit ${shopName} online:`} size="lg" variant="default" className="min-h-11" />
        <Button type="button" variant="outline" size="lg" className="min-h-11" onClick={copy}>
          <Copy aria-hidden />
          {SHOP_HUB_COPY.copyLink}
        </Button>
        <Button asChild variant="ghost" size="lg" className="min-h-11">
          <Link prefetch={false} href={path} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            {SHOP_HUB_COPY.seeAsBuyer}
          </Link>
        </Button>
      </div>
    </section>
  );
}
