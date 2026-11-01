"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useServerForm } from "@/hooks/core/useServerForm";
import { fulfilmentFeeSchema, type FulfilmentFeeInput } from "@/lib/validation/schemas/fulfilment-settings.schema";
import { feeApiClient } from "./feeApiClient";
import { FEE_COPY } from "./fee-copy";

/**
 * The fee field (order-fulfilment D14, A12). The version the admin saw travels with the save, so a
 * change another admin made meanwhile is refused with who and when, not overwritten (ux.md Stale).
 */
export function useFeeForm(saved: { feeRupees: number; version: number }) {
  const router = useRouter();
  const form = useServerForm<FulfilmentFeeInput>({
    schema: fulfilmentFeeSchema,
    defaultValues: { feeRupees: saved.feeRupees, seenVersion: saved.version },
    submit: (data) => feeApiClient.save(data),
    fallbackMessage: FEE_COPY.retry,
    toastErrors: false,
    onSuccess: (result) => {
      toast.success(FEE_COPY.saved((result as { feeRupees: number }).feeRupees));
      router.refresh();
    },
  });
  const submit = (event?: React.BaseSyntheticEvent) =>
    form.isSubmitting ? event?.preventDefault() : form.onSubmit(event).catch(() => undefined);
  return { form, submit, refresh: () => router.refresh() };
}
