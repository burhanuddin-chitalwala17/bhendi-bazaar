"use client";

import { useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useServerForm } from "@/hooks/core/useServerForm";
import { Button } from "@/components/ui/button";
import { FormInput, FormPhoneInput } from "@/components/shared/forms/FormField";
import { orgsApiClient } from "@/components/org/orgsApiClient";
import { openShopSchema, type OpenShopInput } from "@/lib/validation/schemas/org.schema";

/**
 * The three things a shop is opened with (org-profile D1, Q2). Labels, hints and placeholders
 * are the ux copy; the screen around it comes with the onboarding work (its U2).
 */
export function OpenShopForm({ accountEmail }: { accountEmail?: string | null }) {
  const router = useRouter();
  // A second tap must not open a second shop; the button stays tappable (ADR-0053), so the
  // guard is here. It stays shut after success, while the page navigates away.
  const busy = useRef(false);
  const opened = useRef(false);
  const {
    register,
    control,
    onSubmit,
    formError,
    isSubmitting,
    formState: { errors },
  } = useServerForm<OpenShopInput>({
    schema: openShopSchema,
    defaultValues: { name: "", phone: "", email: accountEmail ?? "" },
    submit: (data) => orgsApiClient.create(data),
    successMessage: "Your shop is open",
    fallbackMessage: "Couldn't open your shop. Check your internet and try again.",
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
    try {
      await onSubmit(event);
    } catch {
      // Shown by useServerForm; what was typed stays.
    } finally {
      busy.current = opened.current;
    }
  };

  return (
    <form onSubmit={submitOnce} className="space-y-4" noValidate>
      {formError && (
        <div role="alert" className="rounded-card border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {formError}
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
        {isSubmitting ? "Opening your shop…" : "Create my shop"}
      </Button>
    </form>
  );
}
