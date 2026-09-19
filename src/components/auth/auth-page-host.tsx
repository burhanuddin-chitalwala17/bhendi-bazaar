"use client";

import { useRouter } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import {
  AUTH_VIEW_COPY,
  AUTH_VIEW_PATHS,
  type AuthView,
  type SwitchAuthView,
} from "@/components/auth/auth-view";

/**
 * A sign-in page: a heading plus the shared form (D1). Views are separate routes here,
 * and every one carries the already-sanitised `callbackUrl` on to the next (D5).
 */
export function AuthPageHost({
  view,
  callbackUrl,
}: {
  view: AuthView;
  callbackUrl: string;
}) {
  const router = useRouter();
  const copy = AUTH_VIEW_COPY[view];

  const onSwitchView: SwitchAuthView = (next) => {
    const query =
      callbackUrl === "/"
        ? ""
        : `?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    router.push(`${AUTH_VIEW_PATHS[next]}${query}`);
  };

  const onSuccess = () => {
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1 text-center">
        <p className="text-2xs font-semibold uppercase tracking-display text-muted-foreground/80">
          {copy.eyebrow}
        </p>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {copy.title}
        </h1>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </header>

      {view === "signin" && (
        <SignInForm
          onSuccess={onSuccess}
          onSwitchView={onSwitchView}
          googleCallbackUrl={callbackUrl}
        />
      )}
      {view === "signup" && (
        <SignUpForm
          onSuccess={onSuccess}
          onSwitchView={onSwitchView}
          googleCallbackUrl={callbackUrl}
        />
      )}
      {view === "forgot" && <ForgotPasswordForm onSwitchView={onSwitchView} />}
    </div>
  );
}
