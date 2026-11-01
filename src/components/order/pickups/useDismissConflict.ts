"use client";

import { useRouter } from "next/navigation";

import { useMutation } from "@/hooks/core/useMutation";
import { pickupsApiClient } from "./pickupsApiClient";
import { CONFLICT_COPY } from "./pickups-copy";

/** "Dismiss" on a conflict row; the row moves to resolved on refresh. */
export function useDismissConflict(conflictId: string) {
  const router = useRouter();
  const { mutate, isLoading } = useMutation(() => pickupsApiClient.dismissConflict(conflictId), {
    successMessage: CONFLICT_COPY.dismissed,
    onSuccess: () => router.refresh(),
  });
  return { dismiss: () => (isLoading ? undefined : mutate().catch(() => undefined)), dismissing: isLoading };
}
