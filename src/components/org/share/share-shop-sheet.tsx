"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";
import { truncateMiddle } from "@/components/org/shop-hub/shop-hub-copy";
import type { ShareShop } from "@/lib/store-preview";
import { SHARE_COPY, whatsappHref } from "./share-copy";
import { COPY_STATE, useShareShop, type ShareSetup } from "./useShareShop";

const LINK_MAX = 44;

/**
 * The share sheet (own-store onboarding D13, R10): the link, the card a chat will show for it, and
 * "Share on WhatsApp", "Copy link", "See as a buyer". A bottom sheet on a phone, a popover from `lg:`.
 */
export function ShareShopSheet({
  orgId,
  shop,
  setup,
  trigger,
  description,
  open: controlledOpen,
  onOpenChange,
}: {
  orgId: string;
  shop: ShareShop;
  setup: ShareSetup | null;
  trigger: ReactNode;
  /** The setup step's hint, when the sheet is opened from the list. */
  description?: string;
  /** Given when something besides the trigger opens it (Home's toast after the first product). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const { shareOnWhatsApp, copyLink, copyState } = useShareShop(orgId, shop.url, setup);
  const shown = shop.url.replace(/^https?:\/\//, "");

  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      wide={HANDOFF_WIDE.POPOVER}
      title={SHARE_COPY.title}
      closeLabel={SHARE_COPY.close}
      description={description}
      trigger={trigger}
    >
      <div className="space-y-4">
        <p className="select-all break-all font-medium text-foreground" title={shown}>
          {truncateMiddle(shown, LINK_MAX)}
        </p>
        {copyState === COPY_STATE.COPIED && <p className="text-sm text-muted-foreground">{SHARE_COPY.pasteAnywhere}</p>}
        {copyState === COPY_STATE.FAILED && <p className="text-sm text-muted-foreground">{SHARE_COPY.copyFailed}</p>}

        <PreviewCard shop={shop} host={shown.split("/")[0] ?? shown} />

        <div className="grid gap-2">
          <Button asChild size="lg" className="min-h-11">
            <a href={whatsappHref(shop.name, shop.url)} target="_blank" rel="noopener noreferrer" onClick={() => void shareOnWhatsApp()}>
              <MessageCircle aria-hidden />
              {SHARE_COPY.whatsapp}
            </a>
          </Button>
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
      </div>
    </HandoffSheet>
  );
}

/** The store's Open Graph card as a chat draws it; the muted box holds its place while the image loads. */
function PreviewCard({ shop, host }: { shop: ShareShop; host: string }) {
  const { preview } = shop;
  return (
    <figure className="overflow-hidden rounded-card border border-border bg-card">
      {preview.image && (
        <div className="relative aspect-[1.91/1] w-full bg-muted">
          <Image src={preview.image} alt="" fill sizes="(min-width: 1024px) 320px, 100vw" className="object-cover" />
        </div>
      )}
      <figcaption className="space-y-0.5 p-3">
        <p className="truncate text-xs text-muted-foreground">{host}</p>
        <p className="line-clamp-1 text-sm font-semibold text-foreground">{preview.title}</p>
        <p className="line-clamp-2 text-sm text-muted-foreground">{preview.description}</p>
      </figcaption>
    </figure>
  );
}
