"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { MatchPicker } from "./match-picker";
import { SETTLE_ACTION, SETTLE_TOAST } from "./settle-copy";

interface ListingSettleActionsProps {
  orgId: string;
  channel: MarketplaceChannel;
  label: string;
  listingId: string;
}

/** The details panel's three choices for an unsettled listing (product-merge R1). Never disabled. */
export function ListingSettleActions({ orgId, channel, label, listingId }: ListingSettleActionsProps) {
  const router = useRouter();
  const addNewHref = `/org/${orgId}/channels/settle?listing=${listingId}`;

  const bringBack = useMutation(() => channelsApiClient.bringBackListing(orgId, channel, listingId), {
    showToast: false,
    onSuccess: () => {
      toast.success(SETTLE_TOAST.broughtBack);
      router.refresh();
    },
    onError: () => toast.error(SETTLE_TOAST.failed),
  });

  const leaveOff = useMutation(() => channelsApiClient.leaveOffListing(orgId, channel, listingId), {
    showToast: false,
    onSuccess: () => {
      toast(SETTLE_TOAST.leftOff, {
        duration: 5000,
        action: { label: SETTLE_ACTION.undo, onClick: () => void bringBack.mutate().catch(() => undefined) },
      });
      router.refresh();
    },
    onError: () => toast.error(SETTLE_TOAST.failed),
  });

  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:justify-end">
      <Button asChild className="min-h-10">
        <Link href={addNewHref}>{SETTLE_ACTION.addNew}</Link>
      </Button>
      <MatchPicker
        orgId={orgId}
        listingId={listingId}
        label={label}
        addNewHref={addNewHref}
        trigger={
          <Button variant="outline" className="min-h-10">
            {SETTLE_ACTION.match}
          </Button>
        }
      />
      <Button
        variant="ghost"
        className="min-h-10"
        onClick={() => void leaveOff.mutate().catch(() => undefined)}
        pending={leaveOff.isLoading}
      >
        {SETTLE_ACTION.leaveOff}
      </Button>
    </div>
  );
}
