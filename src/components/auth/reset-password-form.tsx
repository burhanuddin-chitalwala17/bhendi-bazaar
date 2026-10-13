"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthField, PRIMARY_BUTTON } from "@/components/auth/auth-field";
import { PasswordInput } from "@/components/auth/password-input";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/schemas/auth.schemas";
import { authApiClient } from "@/components/auth/authApiClient";

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
      setTimeout(() => router.push("/signin"), 3000);
    },
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  if (done) {
    return (
      <div className="space-y-4 rounded-card border border-success/30 bg-success/10 p-6 text-center">
        <CheckCircle className="mx-auto size-12 text-success" />
        <div className="space-y-2">
          <h2 className="font-semibold text-success">Password reset</h2>
          <p className="text-sm text-success">
            Your password has been changed. Taking you to sign in…
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" {...register("token")} />

      <AuthField id={`${id}-password`} label="New password" error={errors.password?.message}>
        <PasswordInput
          id={`${id}-password`}
          autoComplete="new-password"
          {...register("password")}
        />
        {!errors.password && (
          <p className="text-2xs text-muted-foreground">
            At least 8 characters with uppercase, lowercase, a number and a symbol
          </p>
        )}
      </AuthField>

      <AuthField
        id={`${id}-confirm`}
        label="Confirm password"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id={`${id}-confirm`}
          autoComplete="new-password"
          {...register("confirmPassword")}
        />
      </AuthField>

      {(formError || errors.token) && (
        <p className="rounded-field bg-destructive/10 p-3 text-sm text-destructive">
          {formError ?? errors.token?.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
