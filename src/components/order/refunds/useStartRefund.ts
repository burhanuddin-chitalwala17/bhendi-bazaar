"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation } from "@/hooks/core/useMutation";
import { refundsApiClient } from "./refundsApiClient";
import { REFUNDS_COPY } from "./refunds-copy";

/**
 * "Refund ₹{x}" behind its confirm sheet (D17, A9). A start toasts; an unconfirmed or refused answer
 * is on the row after the refresh, so the admin reads it where they act. A refusal (already started) toasts its reason.
 */
export function useStartRefund(refundId: string, amountPaise: number, buyerEmailed = true) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { mutate, isLoading } = useMutation(() => refundsApiClient.start(refundId), {
    onSuccess: (outcome) => {
      if (outcome.kind === "started") toast.success(REFUNDS_COPY.success(amountPaise, buyerEmailed));
      else if (outcome.kind === "unconfirmed") toast.warning(REFUNDS_COPY.unconfirmed);
      else toast.error(REFUNDS_COPY.refused(outcome.reason));
      setOpen(false);
      router.refresh();
    },
    onError: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return {
    open,
    setOpen,
    start: () => (isLoading ? undefined : mutate().catch(() => undefined)),
    starting: isLoading,
  };
}
