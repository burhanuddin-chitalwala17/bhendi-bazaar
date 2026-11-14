"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { LISTINGS, ROW } from "./listing-copy";
import { FEATURE } from "@/components/subscriptions/features";

/** "Read again" (R2). A tap while a read runs is harmless: the job claims one read at a time (D3). */
export function ReadAgainButton({ orgId, channel }: { orgId: string; channel: MarketplaceChannel }) {
  const router = useRouter();
  const read = useMutation(() => channelsApiClient.readListings(orgId, channel), {
    showToast: false,
    onSuccess: () => {
      toast(LISTINGS.readingAgain);
      router.refresh();
    },
    onError: (error) => toast.error(error.message || ROW.failed),
  });
  return (
    <LockedAction feature={FEATURE.CHANNELS} label={LISTINGS.readAgain} variant="outline" className="min-h-10 w-full md:w-auto">
      <Button
        variant="outline"
        className="min-h-10 w-full md:w-auto"
        onClick={() => void read.mutate().catch(() => undefined)}
        pending={read.isLoading}
      >
        {LISTINGS.readAgain}
      </Button>
    </LockedAction>
  );
}
