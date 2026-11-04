"use client";

import { useId } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerForm } from "@/hooks/core/useServerForm";
import {
  signupSchema,
  type SignupInput,
} from "@/lib/validation/schemas/auth.schemas";
import {
  AuthField,
  OrDivider,
  PRIMARY_BUTTON,
} from "@/components/auth/auth-field";
import { PasswordInput } from "@/components/auth/password-input";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SWITCH_LINK, type AuthFormHost } from "@/components/auth/sign-in-form";
import { authApiClient } from "@/components/auth/authApiClient";
import type { AuthDone } from "@/components/auth/auth-view";
import { AUTH_COPY } from "./auth-copy";

/**
 * Create an account, then sign straight in. If that sign-in fails the account still
 * exists, so the host is asked for Sign in with the email filled (D4).
 */
export function SignUpForm({
  onSuccess,
  onSwitchView,
  googleCallbackUrl,
  onBeforeGoogle,
}: AuthFormHost & { onSuccess: AuthDone }) {
  const id = useId();

  // The same schema the route parses (Invariant 4): password rules show inline as
  // the user types them, and a server detail — a taken email — lands on its field.
  const {
    register,
    onSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<SignupInput>({
    schema: signupSchema,
    submit: async (data) => {
      await authApiClient.signUp(data);

      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });
      if (!result || result.error) {
        onSwitchView("signin", { email: data.email });
        return;
      }
      await onSuccess();
    },
    defaultValues: { name: "", email: "", password: "" },
  });

  return (
    <form
      onSubmit={(event) => void onSubmit(event).catch(() => {})}
      className="space-y-3 text-small"
    >
      <AuthField id={`${id}-name`} label={AUTH_COPY.name} error={errors.name?.message}>
        <Input id={`${id}-name`} autoComplete="name" {...register("name")} />
      </AuthField>
      <AuthField id={`${id}-email`} label={AUTH_COPY.email} error={errors.email?.message}>
        <Input
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          {...register("email")}
        />
      </AuthField>
      <AuthField
        id={`${id}-password`}
        label={AUTH_COPY.password}
        error={errors.password?.message}
      >
        <PasswordInput
          id={`${id}-password`}
          autoComplete="new-password"
          {...register("password")}
        />
      </AuthField>

      {formError && (
        <p role="alert" className="text-2xs text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className={PRIMARY_BUTTON}>
        {isSubmitting ? AUTH_COPY.creatingAccount : AUTH_COPY.createAccount}
      </Button>
      <OrDivider />
      <GoogleSignInButton
        callbackUrl={googleCallbackUrl}
        beforeRedirect={onBeforeGoogle}
      />
      <p className="pt-2 text-center text-2xs text-muted-foreground">
        {AUTH_COPY.haveAccount}{" "}
        <Button
          variant="ghost"
          type="button"
          onClick={() => onSwitchView("signin")}
          className={SWITCH_LINK}
        >
          {AUTH_COPY.signIn}
        </Button>
      </p>
    </form>
  );
}
