"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-error";
import { CANCELLED_PARCEL_PREFIX } from "@server/checkout/shop-parcel.types";
import { parcelApiClient } from "./parcelApiClient";
import { SHOP_PARCEL_COPY } from "./parcel-copy";

/**
 * What "Ready for pickup" can come back with (ux.md "Shop parcel"): a refusal sheet (cancelled,
 * or already moved on in another tab — the server's message, either way) or a retry toast.
 */
export type ReadyProblem = { kind: "cancelled" | "stale"; message: string } | null;

/**
 * The shop's "Ready for pickup" (order-fulfilment D6). The confirm sheet opens first; "Yes, it's
 * ready" sends. The button is never disabled: a second press while sending does nothing.
 */
export function useMarkReady(orgId: string, shipmentId: string) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<ReadyProblem>(null);

  const confirm = async () => {
    if (sending) return;
    setSending(true);
    try {
      await parcelApiClient.markReady(orgId, shipmentId);
      setConfirming(false);
      toast.success(SHOP_PARCEL_COPY.toast);
      router.refresh();
    } catch (error) {
      setConfirming(false);
      // 409 carries ux.md's own copy (cancelled, or already ready); 404 means it is not ours to see.
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        const kind = error.message.startsWith(CANCELLED_PARCEL_PREFIX) ? "cancelled" : "stale";
        setProblem({ kind, message: error.message });
      } else {
        toast.error(SHOP_PARCEL_COPY.retry);
      }
    } finally {
      setSending(false);
    }
  };

  const dismissProblem = () => {
    setProblem(null);
    router.refresh();
  };

  return { confirming, open: () => setConfirming(true), close: () => setConfirming(false), confirm, sending, problem, dismissProblem };
}
