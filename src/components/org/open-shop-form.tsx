"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { FormInput, FormPhoneInput } from "@/components/shared/forms/FormField";
import { orgsApiClient } from "@/components/org/orgsApiClient";
import { LINK_PREVIEW_MAX, OPEN_SHOP_COPY as COPY, SLOW_AFTER_MS } from "@/components/org/open-shop-copy";
import { truncateMiddle } from "@/components/org/shop-hub/shop-hub-copy";
import { ApiError } from "@/lib/api-error";
import { handleCandidates } from "@server/catalog/org.handle";
import { openShopSchema, type OpenShopInput } from "@/lib/validation/schemas/org.schema";

/** A failure worth simply sending again: no answer at all, or the server's own fault. */
const isRetryable = (error: unknown) =>
  !(error instanceof ApiError) || error.status >= 500 || error.status === 429;

/**
 * The three things a shop is opened with (org-profile D1, Q2), and the link they make
 * (onboarding D4, Q21). The preview is the server's first candidate; on a clash the
 * server takes the next, and Home shows the real one (Q27).
 */
export function OpenShopForm({ accountEmail, storeBase }: { accountEmail?: string | null; storeBase: string }) {
  const router = useRouter();
  // A second tap must not open a second shop; the button stays tappable (ADR-0053), so the
  // guard is here. It stays shut after success, while the page navigates away.
  const busy = useRef(false);
  const opened = useRef(false);
  const [retryable, setRetryable] = useState(false);
  const [slow, setSlow] = useState(false);
  const {
    register,
    control,
    watch,
    onSubmit,
    formError,
    isSubmitting,
    formState: { errors },
  } = useServerForm<OpenShopInput>({
    schema: openShopSchema,
    defaultValues: { name: "", phone: "", email: accountEmail ?? "" },
    submit: (data) => orgsApiClient.create(data),
    successMessage: COPY.opened,
    fallbackMessage: COPY.retryable,
    onSuccess: (org) => {
      opened.current = true;
      router.push(`/org/${(org as { id: string }).id}`);
      router.refresh();
    },
  });

  const submitOnce = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setRetryable(false);
    try {
      await onSubmit(event);
    } catch (error) {
      // What was typed stays. A retryable fault shows the ux copy, not the server's generic message.
      setRetryable(isRetryable(error));
    } finally {
      busy.current = opened.current;
    }
  };

  useEffect(() => {
    if (!isSubmitting) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [isSubmitting]);

  const name = watch("name") ?? "";
  const handle = handleCandidates(name).next().value as string;

  return (
    <form onSubmit={submitOnce} className="space-y-4" noValidate>
      {formError && (
        <div role="alert" className="rounded-card border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p>{retryable ? COPY.retryable : formError}</p>
          {retryable && (
            <Button type="submit" variant="outline" className="mt-2 h-11">
              {COPY.retry}
            </Button>
          )}
        </div>
      )}
      <FormInput
        label="Shop name"
        hint="Buyers see this on your shop and every product."
        placeholder="Noor Attar House"
        autoComplete="organization"
        error={errors.name?.message}
        {...register("name")}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {COPY.link(storeBase + truncateMiddle(handle, LINK_PREVIEW_MAX))}
      </p>
      <FormPhoneInput
        name="phone"
        control={control}
        label="Your mobile number"
        hint="We'll call or message you about orders and pickups. Buyers never see it."
        placeholder="98765 43210"
      />
      <FormInput
        label="Email for order updates"
        hint="We send new orders here."
        placeholder="noorattar@gmail.com"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <Button type="submit" className="h-11 w-full" aria-busy={isSubmitting}>
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {isSubmitting ? COPY.submitting : COPY.submit}
      </Button>
      {slow && (
        <p className="text-center text-sm text-muted-foreground" role="status">
          {COPY.slow}
        </p>
      )}
    </form>
  );
}
