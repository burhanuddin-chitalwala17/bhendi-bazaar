"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/schemas/auth.schemas";
import { AuthField, PRIMARY_BUTTON } from "@/components/auth/auth-field";
import { SWITCH_LINK } from "@/components/auth/sign-in-form";
import type { SwitchAuthView } from "@/components/auth/auth-view";
import { authApiClient } from "@/components/auth/authApiClient";

/** Ask for a reset link and confirm in place; the emailed link opens a page (R4). */
export function ForgotPasswordForm({
  onSwitchView,
  defaultEmail = "",
}: {
  onSwitchView: SwitchAuthView;
  defaultEmail?: string;
}) {
  const id = useId();
  const [sent, setSent] = useState(false);

  const {
    register,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<ForgotPasswordInput>({
    schema: forgotPasswordSchema,
    submit: (data) => authApiClient.forgotPassword(data),
    onSuccess: () => setSent(true),
    defaultValues: { email: defaultEmail },
  });

  const back = (
    <Button
      variant="ghost"
      type="button"
      onClick={() => onSwitchView("signin")}
      className={SWITCH_LINK}
    >
      <Icon name="back" size="xs" className="mr-1" />
      Back to sign in
    </Button>
  );

  if (sent) {
    return (
      <div className="space-y-3">
        <div
          role="status"
          className="space-y-2 rounded-card border border-success/30 bg-success/10 p-4 text-center"
        >
          <Icon name="email" size="xl" tone="success" className="mx-auto" />
          <p className="font-semibold text-success">Check your inbox</p>
          <p className="text-small text-success">
            If an account exists with this email, you&apos;ll receive a password
            reset link shortly.
          </p>
        </div>
        {back}
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event).catch(() => {})}
      className="space-y-3 text-small"
    >
      <AuthField id={`${id}-email`} label="Email" error={errors.email?.message}>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          placeholder="your@email.com"
          {...register("email")}
        />
      </AuthField>
      {formError && (
        <p role="alert" className="text-2xs text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
      {back}
    </form>
  );
}
