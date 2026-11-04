"use client";

import { useState } from "react";
import NextImage from "next/image";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { rupeesToPaise } from "@/lib/format";
import type { ProductMediaInput } from "@server/catalog/media";
import { BUYER_PREVIEW_COPY } from "./product-copy";

/**
 * The product as a buyer will see it, from the unsaved values (product-form R3, Q19). Display only:
 * what is charged is recomputed by the server from the saved price (Invariant 1).
 */
export function BuyerPreview({
  name,
  description,
  price,
  salePrice,
  media,
}: {
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  media: ProductMediaInput[];
}) {
  const [expanded, setExpanded] = useState(false);
  const photos = media.filter((item) => item.kind === "IMAGE");
  const cover = photos.find((item) => item.isThumbnail) ?? null;
  const hasVideo = media.some((item) => item.kind !== "IMAGE");
  const pricePaise = Number.isFinite(price) && price > 0 ? rupeesToPaise(price) : 0;
  const salePaise = salePrice != null && Number.isFinite(salePrice) && salePrice > 0 ? rupeesToPaise(salePrice) : null;

  return (
    <div className="space-y-3 rounded-card border border-border bg-card p-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-field bg-muted">
        {cover ? (
          <NextImage src={cover.ref} alt={name} fill sizes="(min-width: 1024px) 25vw, 100vw" className="object-contain" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{BUYER_PREVIEW_COPY.noCoverYet}</span>
        )}
      </div>
      {(photos.length > 1 || hasVideo) && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {photos.map((item) => (
            <div key={item.ref} className="relative size-14 shrink-0 overflow-hidden rounded-field bg-muted">
              <NextImage src={item.ref} alt="" fill sizes="56px" className="object-cover" />
            </div>
          ))}
          {hasVideo && (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-field bg-muted">
              <Icon name="video" size="md" tone="muted" label={BUYER_PREVIEW_COPY.video} />
            </span>
          )}
        </div>
      )}
      <p className="break-words font-semibold text-foreground">{name || "Your product's name"}</p>
      {pricePaise > 0 && <PriceDisplay price={pricePaise} salePrice={salePaise} size="sm" />}
      {description && (
        <div>
          <p className={expanded ? "whitespace-pre-line text-sm text-muted-foreground" : "line-clamp-3 whitespace-pre-line text-sm text-muted-foreground"}>
            {description}
          </p>
          {!expanded && description.length > 160 && (
            <Button type="button" variant="link" size="sm" className="px-0" onClick={() => setExpanded(true)}>
              {BUYER_PREVIEW_COPY.more}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
