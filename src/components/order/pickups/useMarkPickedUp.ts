"use client";

import { useRouter } from "next/navigation";

import { useMutation } from "@/hooks/core/useMutation";
import { pickupsApiClient } from "./pickupsApiClient";
import { PICKED_UP_COPY } from "./pickups-copy";

/** "Mark picked up" when the courier is silent (Q4); a refusal toasts the server's reason. */
export function useMarkPickedUp(shipmentId: string) {
  const router = useRouter();
  const { mutate, isLoading } = useMutation(() => pickupsApiClient.markPickedUp(shipmentId), {
    successMessage: PICKED_UP_COPY.success,
    onSuccess: () => router.refresh(),
  });
  return { mark: () => (isLoading ? undefined : mutate().catch(() => undefined)), marking: isLoading };
}
