"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { SETTLE_ACTION, SETTLE_TOAST } from "./settle-copy";
import { FEATURE } from "@/components/subscriptions/features";

/** Copy a listing's photos again after some failed (product-merge Q21). */
export function RetryPhotosButton({ orgId, channel, listingId }: { orgId: string; channel: MarketplaceChannel; listingId: string }) {
  const router = useRouter();
  const retry = useMutation(() => channelsApiClient.retryListingPhotos(orgId, channel, listingId), {
    showToast: false,
    onSuccess: () => router.refresh(),
    onError: () => toast.error(SETTLE_TOAST.failed),
  });
  return (
    <LockedAction feature={FEATURE.CHANNELS} label={SETTLE_ACTION.tryAgain} variant="outline" size="sm">
      <Button variant="outline" size="sm" onClick={() => void retry.mutate().catch(() => undefined)} pending={retry.isLoading}>
        {SETTLE_ACTION.tryAgain}
      </Button>
    </LockedAction>
  );
}
