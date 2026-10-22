"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { SETTLE_ACTION, SETTLE_TOAST } from "./settle-copy";

/** Copy a listing's photos again after some failed (product-merge Q21). */
export function RetryPhotosButton({ orgId, channel, listingId }: { orgId: string; channel: MarketplaceChannel; listingId: string }) {
  const router = useRouter();
  const retry = useMutation(() => channelsApiClient.retryListingPhotos(orgId, channel, listingId), {
    showToast: false,
    onSuccess: () => router.refresh(),
    onError: () => toast.error(SETTLE_TOAST.failed),
  });
  return (
    <Button variant="outline" size="sm" onClick={() => void retry.mutate().catch(() => undefined)} aria-busy={retry.isLoading}>
      {retry.isLoading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {SETTLE_ACTION.tryAgain}
    </Button>
  );
}
