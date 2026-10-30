"use client";

import { useEffect, useRef, useState } from "react";
import type { DefaultValues, FieldValues } from "react-hook-form";
import type { ZodType } from "zod";

import { useServerForm } from "@/hooks/core/useServerForm";
import { ApiError } from "@/lib/api-error";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import { SHOP_DETAILS_COPY } from "./shop-details-copy";

const SLOW_AFTER_MS = 3000;

/** Which banner a failed save shows on its section (ux Retryable error, Stale). */
export type SectionProblem = { kind: "stale"; message: string } | { kind: "retry" } | null;

/**
 * One Shop details section's save (org-profile D3, R9): the form, the version it read (Q21), and
 * the states the section shows — "Still saving…" after 3 s, a stale banner on a 409, and a
 * retry banner when the save never landed. What was typed stays in every case.
 */
export function useShopDetailsSection<T extends FieldValues>({
  schema,
  defaultValues,
  save,
  onSaved,
  successMessage = SHOP_DETAILS_COPY.saved,
}: {
  schema: ZodType<T>;
  defaultValues: DefaultValues<T>;
  save: (data: T) => Promise<ShopDetailsDto>;
  onSaved: (details: ShopDetailsDto) => void;
  successMessage?: string;
}) {
  const [problem, setProblem] = useState<SectionProblem>(null);
  const [slow, setSlow] = useState(false);
  const busy = useRef(false);

  const form = useServerForm<T>({
    schema,
    defaultValues,
    submit: save,
    successMessage,
    // The section's own banner says it; a toast would say it twice.
    toastErrors: false,
    onSuccess: (result) => onSaved(result as ShopDetailsDto),
  });

  useEffect(() => {
    if (!form.isSubmitting) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [form.isSubmitting]);

  // The button stays tappable (ADR-0053); a second tap while one save is in flight is a no-op.
  const submit = async (event?: React.BaseSyntheticEvent) => {
    event?.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setProblem(null);
    try {
      await form.onSubmit(event);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setProblem({ kind: "stale", message: error.message });
      else if (!(error instanceof ApiError) || error.status >= 500) setProblem({ kind: "retry" });
    } finally {
      busy.current = false;
    }
  };

  return { ...form, submit, problem, slow };
}
