"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DefaultValues, FieldValues } from "react-hook-form";
import type { ZodType } from "zod";

import { ApiError } from "@/lib/api-error";
import { useServerForm } from "@/hooks/core/useServerForm";

/** ux.md "Retryable error" on every cancel sheet. */
export const CANCEL_RETRY = "Couldn't cancel. Try again.";

/**
 * One cancel sheet's state: open, the reason form, and a refusal that replaces the list (ux.md
 * "Refused" rows). A 409 or 404 is a refusal in the server's words; anything else is retryable.
 * The button is never disabled (R15): a second press while sending does nothing.
 */
export function useCancelForm<T extends FieldValues, R>(options: {
  schema: ZodType<T>;
  defaultValues: DefaultValues<T>;
  send: (data: T) => Promise<R>;
  onSent: (result: R) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const form = useServerForm<T>({
    schema: options.schema,
    defaultValues: options.defaultValues,
    toastErrors: false,
    fallbackMessage: CANCEL_RETRY,
    submit: async (data) => {
      try {
        return await options.send(data);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
          setRefused(error.message);
          throw error;
        }
        // A 400 lands on its field; a server or network failure is "Try again".
        if (error instanceof ApiError && error.status === 400) throw error;
        throw new Error(CANCEL_RETRY);
      }
    },
    onSuccess: (result) => {
      setOpen(false);
      options.onSent(result as R);
      router.refresh();
    },
  });

  const submit = (event?: React.BaseSyntheticEvent) => {
    if (form.isSubmitting) {
      event?.preventDefault();
      return undefined;
    }
    return form.onSubmit(event).catch(() => undefined);
  };

  const setSheet = (next: boolean) => {
    setOpen(next);
    if (!next && refused) {
      setRefused(null);
      router.refresh();
    }
  };

  return { open, setOpen: setSheet, form, submit, refused, closeRefused: () => setSheet(false) };
}
