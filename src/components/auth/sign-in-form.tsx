"use client";

import { useId } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  loginSchema,
  type LoginInput,
} from "@/lib/validation/schemas/auth.schemas";
import {
  AuthField,
  OrDivider,
  PRIMARY_BUTTON,
} from "@/components/auth/auth-field";
import { PasswordInput } from "@/components/auth/password-input";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import type { SwitchAuthView } from "@/components/auth/auth-view";

export const SIGN_IN_FAILED = "Invalid email or password.";

export interface AuthFormHost {
  onSwitchView: SwitchAuthView;
  /** Where Google returns the shopper to. */
  googleCallbackUrl: string;
  /** Records what to finish once Google sends the shopper back (D7). */
  onBeforeGoogle?: () => void;
}

export const SWITCH_LINK =
  "inline-flex min-h-10 items-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

/**
 * Sign in — the one form the page and the sheet both render (seamless-sign-in D1).
 * `redirect: false` keeps the shopper where they are; next-auth refreshes the session
 * store on success, and the host decides what happens next.
 */
export function SignInForm({
  onSuccess,
  onSwitchView,
  googleCallbackUrl,
  onBeforeGoogle,
  defaultEmail = "",
}: AuthFormHost & {
  onSuccess: () => void | Promise<void>;
  defaultEmail?: string;
}) {
  const id = useId();

  // The same schema the credentials provider validates with; next-auth reports a
  // single failure, which lands as the form-level error (ADR-0013).
  const {
    register,
    getValues,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<LoginInput>({
    schema: loginSchema,
    submit: async (data) => {
      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });
      if (!result || result.error) throw new Error(SIGN_IN_FAILED);
      await onSuccess();
    },
    defaultValues: { email: defaultEmail, password: "" },
  });

  return (
    <form
      onSubmit={(event) => void onSubmit(event).catch(() => {})}
      className="space-y-3 text-sm"
    >
      <AuthField id={`${id}-email`} label="Email" error={errors.email?.message}>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          {...register("email")}
        />
      </AuthField>
      <AuthField
        id={`${id}-password`}
        label="Password"
        error={errors.password?.message}
      >
        <PasswordInput
          id={`${id}-password`}
          autoComplete="current-password"
          {...register("password")}
        />
      </AuthField>

      <div className="flex justify-end">
        <Button
          variant="ghost"
          type="button"
          onClick={() =>
            onSwitchView("forgot", { email: getValues("email") || undefined })
          }
          className={SWITCH_LINK}
        >
          Forgot password?
        </Button>
      </div>
      {formError && (
        <p role="alert" className="text-2xs text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? "Signing in..." : "Sign in"}
      </Button>
      <OrDivider />
      <GoogleSignInButton
        callbackUrl={googleCallbackUrl}
        beforeRedirect={onBeforeGoogle}
      />
      <p className="pt-2 text-center text-2xs text-muted-foreground">
        New to Bhendi Bazaar?{" "}
        <Button
          variant="ghost"
          type="button"
          onClick={() => onSwitchView("signup")}
          className={SWITCH_LINK}
        >
          Create an account
        </Button>
      </p>
    </form>
  );
}
