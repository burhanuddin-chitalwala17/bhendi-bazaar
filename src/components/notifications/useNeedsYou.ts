"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { notificationsApiClient } from "./notificationsApiClient";

/** The Needs you list, read each time the sheet opens, so an item fixed elsewhere is gone (ux: Stale). */
export function useNeedsYou(orgId: string, open: boolean) {
  return useAsyncData((signal) => notificationsApiClient.needsYou(orgId, signal), { enabled: open, refetchDependencies: [orgId, open] });
}
