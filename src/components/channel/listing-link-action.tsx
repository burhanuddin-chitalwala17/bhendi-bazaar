"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { ROW } from "./listing-copy";

interface ListingLinkActionProps {
  orgId: string;
  channel: MarketplaceChannel;
  listingId: string;
  /** Unlink a linked row (Q5), or Link back one the owner unlinked (Q16). */
  kind: "unlink" | "linkBack";
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

  const action = kind === "unlink" ? unlink : linkBack;
  return (
    <Button
      variant="outline"
      size="sm"
      className="min-h-10 shrink-0"
      onClick={() => void action.mutate().catch(() => undefined)}
      aria-busy={action.isLoading}
    >
      {action.isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {kind === "unlink" ? ROW.unlink : ROW.linkBack}
    </Button>
  );
}
