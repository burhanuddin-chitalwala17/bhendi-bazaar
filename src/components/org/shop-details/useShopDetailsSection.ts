"use client";

import { useRef, useState } from "react";
import type { DefaultValues, FieldValues } from "react-hook-form";
import type { ZodType } from "zod";

import { useServerForm } from "@/hooks/core/useServerForm";
import { ApiError } from "@/lib/api-error";
import type { ShopDetailsDto } from "@server/catalog/shop-details.types";
import { SHOP_DETAILS_COPY } from "./shop-details-copy";
import { useSaveBarEntry } from "./useSaveBar";

/** Which banner a failed save shows on its section (ux Retryable error, Stale). */
export type SectionProblem = { kind: "stale"; message: string } | { kind: "retry" } | null;

/**
 * One Shop details section (org-profile D3, Q30): its form, joined to the page's one save bar.
 * Saved alone with the version the page holds now (Q21); a 409 shows the stale banner, a save that
 * never landed the retry banner, and what was typed stays in every case.
 */
export function useShopDetailsSection<T extends FieldValues>({
  id,
  schema,
  defaultValues,
  save,
  onSaved,
  successMessage = SHOP_DETAILS_COPY.saved,
}: {
  /** The section's key on the save bar, and its form's id. */
  id: string;
  schema: ZodType<T>;
  defaultValues: DefaultValues<T>;
  save: (data: T) => Promise<ShopDetailsDto>;
  onSaved: (details: ShopDetailsDto) => void;
  successMessage?: string;
}) {
  const [problem, setProblem] = useState<SectionProblem>(null);
  const landed = useRef(false);

  const form = useServerForm<T>({
    schema,
    defaultValues,
    submit: save,
    // The bar says it once for every section saved; the section's own banner says a failure.
    toastErrors: false,
    onSuccess: (result) => {
      landed.current = true;
      onSaved(result as ShopDetailsDto);
    },
  });

  const submit = async (): Promise<boolean> => {
    landed.current = false;
    setProblem(null);
    // What is sent, as typed: typing during a slow save stays unsaved rather than becoming the baseline.
    const sent = form.getValues();
    try {
      await form.onSubmit();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) setProblem({ kind: "stale", message: error.message });
      else if (!(error instanceof ApiError) || error.status >= 500) setProblem({ kind: "retry" });
      return false;
    }
    // A validation miss resolves without saving; its message is already on the field.
    if (landed.current) form.reset(sent, { keepValues: true });
    return landed.current;
  };

  useSaveBarEntry(id, {
    dirty: form.formState.isDirty,
    save: submit,
    discard: () => {
      setProblem(null);
      form.clearFormError();
      form.reset();
    },
    message: successMessage,
  });

  return { ...form, problem };
}
