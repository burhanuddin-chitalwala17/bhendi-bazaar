"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { ROW } from "./listing-copy";
import { SETTLE_ACTION, SETTLE_TOAST } from "./settle-copy";
import { FEATURE } from "@/components/subscriptions/features";

interface ListingLinkActionProps {
  orgId: string;
  channel: MarketplaceChannel;
  listingId: string;
  /** Unlink a linked row (Q5), Link back one the owner unlinked (Q16), or Bring back one left off (product-merge Q9). */
  kind: "unlink" | "linkBack" | "bringBack";
}

/** The row's one action. Never disabled; the toast's Undo is Link back (ux.md journey 3). */
export function ListingLinkAction({ orgId, channel, listingId, kind }: ListingLinkActionProps) {
  const router = useRouter();

  const linkBack = useMutation(() => channelsApiClient.linkBackListing(orgId, channel, listingId), {
    showToast: false,
    onSuccess: ({ listing }) => {
      if (listing.product) toast.success(ROW.linkedTo(listing.product.name));
      router.refresh();
    },
    onError: (error) => toast.error(error.message || ROW.failed),
  });

  const unlink = useMutation(() => channelsApiClient.unlinkListing(orgId, channel, listingId), {
    showToast: false,
    onSuccess: () => {
      toast(ROW.unlinked, {
        duration: 5000,
        action: { label: ROW.undo, onClick: () => void linkBack.mutate().catch(() => undefined) },
      });
      router.refresh();
    },
    onError: () => toast.error(ROW.failed),
  });

  const bringBack = useMutation(() => channelsApiClient.bringBackListing(orgId, channel, listingId), {
    showToast: false,
    onSuccess: () => {
      toast.success(SETTLE_TOAST.broughtBack);
      router.refresh();
    },
    onError: () => toast.error(SETTLE_TOAST.failed),
  });

  const action = kind === "unlink" ? unlink : kind === "linkBack" ? linkBack : bringBack;
  const label = kind === "unlink" ? ROW.unlink : kind === "linkBack" ? ROW.linkBack : SETTLE_ACTION.bringBack;
  return (
    <LockedAction feature={FEATURE.CHANNELS} label={label} variant="outline" size="sm" className="min-h-10 shrink-0">
      <Button
        variant="outline"
        size="sm"
        className="min-h-10 shrink-0"
        onClick={() => void action.mutate().catch(() => undefined)}
        pending={action.isLoading}
      >
        {label}
      </Button>
    </LockedAction>
  );
}
