"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { listingsApiClient } from "./listingsApiClient";

/** Pages already on the marketplace for a product, read when the page opens (marketplace-publish D6). */
export function usePagesSearch(orgId: string, productId: string, channel: MarketplaceChannel) {
  return useAsyncData((signal) => listingsApiClient.findPages(orgId, productId, channel, signal), { refetchDependencies: [orgId, productId, channel] });
}
