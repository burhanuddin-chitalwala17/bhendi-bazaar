"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useMutation } from "@/hooks/core/useMutation";

import { requestsApiClient } from "./requestsApiClient";
import { REQUESTS_COPY as C } from "./requests-copy";

/** One tap raises every ticket a listing needs (setup-requests Q36); the page re-reads to show them. */
export function useRaiseRequest(orgId: string, channel: string, productId: string) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<"raised" | "nothing" | null>(null);
  const mutation = useMutation(() => requestsApiClient.raiseForListing(orgId, channel, productId), {
    errorMessage: C.raiseFailed,
    onSuccess: ({ raised }) => {
      setOutcome(raised === 0 ? "nothing" : "raised");
      router.refresh();
    },
  });
  const raise = () => mutation.mutate().catch(() => undefined);
  return { raise, pending: mutation.isLoading, outcome };
}
