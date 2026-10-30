"use client";

import { useCallback, useState } from "react";
import { useForm, type DefaultValues, type FieldErrors, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { ZodType } from "zod";
import { ApiError, applyServerErrors } from "@/lib/api-error";

interface Options<T extends FieldValues> {
  /** Validates on the client *and* on the server, so the two cannot disagree. */
  schema: ZodType<T>;
  defaultValues?: DefaultValues<T>;
  submit: (data: T) => Promise<unknown>;
  onSuccess?: (result: unknown) => void;
  successMessage?: string;
  /** Shown when the server reports a failure it could not attribute to a field, or the request never arrived. */
  fallbackMessage?: string;
  /**
   * Called when client validation stops a submit, so a form that hides some fields (a step, a
   * closed section) can open the one holding the first error. Given it, the hook leaves the
   * summary to the form (product-form D2).
   */
  onInvalid?: (errors: FieldErrors<T>) => void;
  /** False when the form shows its own failure inline, so the message is not said twice. */
  toastErrors?: boolean;
}

/**
 * react-hook-form wired to the API error contract.
 *
 * A form gets client validation from the same schema the server enforces, and any
 * field-attributed server error lands on its field automatically — the duplicate-SKU
 * case highlights the SKU input without the form knowing that error exists.
 *
 * Forms should not write error handling. If one needs to, this hook is missing
 * something and should grow instead.
 */
export function useServerForm<T extends FieldValues>({
  schema,
  defaultValues,
  submit,
  onSuccess,
  successMessage,
  fallbackMessage = "Could not save. Please try again.",
  onInvalid,
  toastErrors = true,
}: Options<T>) {
  const form = useForm<T>({
    // Cast contained here: zod v4's ZodType and the resolver's expected input/output
    // variance disagree at the type level only. Runtime behaviour is correct.
    resolver: zodResolver(schema as never) as never,
    defaultValues,
  });

  // Errors with no field to sit on — a conflict on something not in the form, a
  // permission failure, an internal fault. Without this they would vanish.
  const [formError, setFormError] = useState<string | null>(null);

  const onSubmit = form.handleSubmit(async (data) => {
    setFormError(null);
    try {
      const result = await submit(data);
      if (successMessage) toast.success(successMessage);
      onSuccess?.(result);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        const { unapplied } = applyServerErrors(
          error.details,
          (path, err, opts) => form.setError(path as Path<T>, err, opts)
        );
        // Show the summary unless every detail already landed on a field — repeating
        // it above the form is noise when the fields are highlighted.
        const leftover = unapplied.map((d) => d.message);
        const showSummary = unapplied.length > 0 || error.details.length === 0;
        if (showSummary) {
          const message = leftover.length ? leftover.join(" ") : error.message;
          setFormError(message);
          if (toastErrors) toast.error(message);
        }
      } else {
        // A TypeError here is fetch failing to reach us; "Failed to fetch" tells nobody anything.
        const message = error instanceof Error && !(error instanceof TypeError) ? error.message : fallbackMessage;
        setFormError(message);
        if (toastErrors) toast.error(message);
      }
      throw error;
    }
  }, (validationErrors) => {
    // A failed submit must never be silent: a field that cannot render its error
    // (a hidden input, an unmounted section) otherwise makes the button "do nothing".
    console.warn("[useServerForm] validation blocked submit:", validationErrors);
    if (onInvalid) onInvalid(validationErrors);
    else setFormError("Please fix the highlighted fields and try again.");
  });

  const clearFormError = useCallback(() => setFormError(null), []);

  return { ...form, onSubmit, formError, clearFormError, isSubmitting: form.formState.isSubmitting };
}
