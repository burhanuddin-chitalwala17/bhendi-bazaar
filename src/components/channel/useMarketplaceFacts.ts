"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceFactsChangeInput } from "@/lib/validation/schemas/marketplace-facts.schema";
import type { FillNowOutcome } from "@server/channels/channel-facts.types";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { CHOOSE } from "./facts-copy";

/**
 * One card's commands (marketplace-facts D8): each sends, toasts what ux.md says, and refreshes the
 * page so the card is recomputed from what was saved. A server message (answered meanwhile) is shown as sent.
 */
export function useMarketplaceFacts(orgId: string, channel: MarketplaceChannel, listingId: string) {
  const router = useRouter();
  const send = useMutation((change: MarketplaceFactsChangeInput) => channelsApiClient.changeMarketplaceFacts(orgId, channel, listingId, change), {
    showToast: false,
    onError: (error) => toast.error(error.message || CHOOSE.failed),
  });

  const run = (change: MarketplaceFactsChangeInput, success?: string): Promise<FillNowOutcome | undefined> =>
    send
      .mutate(change)
      .then((result) => {
        if (success) toast.success(success);
        router.refresh();
        return result.outcome;
      })
      .catch(() => undefined);

  return { run, busy: send.isLoading };
}
