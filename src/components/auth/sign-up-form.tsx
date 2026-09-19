"use client";

import { useId } from "react";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
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

/**
 * Create an account, then sign straight in. If that sign-in fails the account still
 * exists, so the host is asked for Sign in with the email filled (D4).
 */
export function SignUpForm({
  onSuccess,
  onSwitchView,
  googleCallbackUrl,
  onBeforeGoogle,
}: AuthFormHost & { onSuccess: () => void | Promise<void> }) {
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw await readApiError(res);

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
      className="space-y-3 text-sm"
    >
      <AuthField id={`${id}-name`} label="Name" error={errors.name?.message}>
        <Input id={`${id}-name`} autoComplete="name" {...register("name")} />
      </AuthField>
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
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
      <OrDivider />
      <GoogleSignInButton
        callbackUrl={googleCallbackUrl}
        beforeRedirect={onBeforeGoogle}
      />
      <p className="pt-2 text-center text-2xs text-muted-foreground">
        Already have an account?{" "}
        <Button
          variant="ghost"
          type="button"
          onClick={() => onSwitchView("signin")}
          className={SWITCH_LINK}
        >
          Sign in
        </Button>
      </p>
    </form>
  );
}
