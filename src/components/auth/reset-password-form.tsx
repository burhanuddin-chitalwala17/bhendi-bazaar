"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AuthField, PRIMARY_BUTTON } from "@/components/auth/auth-field";
import { PasswordInput } from "@/components/auth/password-input";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/schemas/auth.schemas";
import { authApiClient } from "@/components/auth/authApiClient";
import { AUTH_COPY } from "./auth-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * Set a new password against an emailed token.
 *
 * The token rides in the schema rather than beside it, so an expired link's server error
 * surfaces the same way a weak password does, and the mismatch refine lands on
 * `confirmPassword`. Reuses `PasswordInput` and `AuthField` like every other auth form — this
 * screen had hand-rolled both, plus a single show/hide toggle governing two fields.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const id = useId();
  const [done, setDone] = useState(false);

  const {
    register,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<ResetPasswordInput>({
    schema: resetPasswordSchema,
    submit: (data) => authApiClient.resetPassword(data),
    onSuccess: () => {
      setDone(true);
      setTimeout(() => router.push(ROUTES.signIn), 3000);
    },
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  if (done) {
    return (
      <div className="space-y-4 rounded-card border border-success/30 bg-success/10 p-6 text-center">
        <Icon name="success" size="2xl" tone="success" className="mx-auto" />
        <div className="space-y-2">
          <h2 className="font-semibold text-success">{AUTH_COPY.passwordResetDone}</h2>
          <p className="text-small text-success">{AUTH_COPY.passwordChanged}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" {...register("token")} />

      <AuthField id={`${id}-password`} label={AUTH_COPY.newPassword} error={errors.password?.message}>
        <PasswordInput
          id={`${id}-password`}
          autoComplete="new-password"
          {...register("password")}
        />
        {!errors.password && (
          <p className="text-2xs text-muted-foreground">
            {AUTH_COPY.passwordRules}
          </p>
        )}
      </AuthField>

      <AuthField
        id={`${id}-confirm`}
        label={AUTH_COPY.confirmPassword}
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id={`${id}-confirm`}
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </AuthField>

      {(formError || errors.token) && (
        <p className="rounded-field bg-destructive/10 p-3 text-small text-destructive">
          {formError ?? errors.token?.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? AUTH_COPY.resetting : AUTH_COPY.resetPassword}
      </Button>
    </form>
  );
}
