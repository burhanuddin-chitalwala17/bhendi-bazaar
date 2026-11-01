"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShareShopSheet } from "@/components/org/share/share-shop-sheet";
import { SHARE_COPY } from "@/components/org/share/share-copy";
import type { ShareSetup } from "@/components/org/share/useShareShop";
import type { ShareShop } from "@/lib/store-preview";
import { DoneToast } from "./home-leaves";

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
    <div className="flex min-w-0 items-center gap-2">
      <Link href={shop.path} target="_blank" className="block min-w-0 truncate text-sm text-primary underline-offset-4 hover:underline">
        {shop.url}
      </Link>
      <ShareShopSheet
        orgId={orgId}
        shop={shop}
        setup={setup}
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0">
            <Share2 aria-hidden />
            {SHARE_COPY.open}
          </Button>
        }
      />
      {productToast && <DoneToast message={productToast} actionLabel={SHARE_COPY.open} onAction={openSheet} />}
    </div>
  );
}
