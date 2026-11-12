"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useMutation } from "@/hooks/core/useMutation";
import type { Feature } from "@server/subscriptions/feature-access.types";
import { planApiClient } from "./planApiClient";
import { FEATURE_NAME, SWITCH_TOAST_COPY } from "./subscriptions-copy";

/**
 * One feature's switch on the admin's Plan tab (ux.md Plan tab matrix). Off asks first (Q25); on
 * applies at once. A failure springs the switch back; a stale screen is told what was already true.
 */
export function usePlanSwitch(orgId: string, shop: string, feature: Feature, enabled: boolean) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const name = FEATURE_NAME[feature];

  const { mutate, isLoading } = useMutation((next: boolean) => planApiClient.setFeature(orgId, feature, next), {
    showToast: false,
    onSuccess: (row) => {
      setConfirming(false);
      toast.success(row.enabled ? SWITCH_TOAST_COPY.on(name, shop) : SWITCH_TOAST_COPY.off(name, shop));
      router.refresh();
    },
    onError: () => toast.error(SWITCH_TOAST_COPY.failed(name)),
  });

  const request = (next: boolean) => {
    if (next === enabled) {
      toast.info(SWITCH_TOAST_COPY.already(name, enabled));
      return;
    }
    if (next) void mutate(true).catch(() => undefined);
    else setConfirming(true);
  };

  const confirmOff = () => void mutate(false).catch(() => undefined);

  return { request, confirmOff, confirming, setConfirming, pending: isLoading };
}
