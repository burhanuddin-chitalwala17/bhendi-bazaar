"use client";

import { X } from "lucide-react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { AuthView, SwitchAuthView } from "@/components/auth/auth-view";

const SHEET_TITLES: Record<AuthView, string> = {
  signin: "Sign in",
  signup: "Create an account",
  forgot: "Forgot password",
};

interface AuthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: AuthView;
  /** Why the sheet was opened — "Sign in to save this" (R10). */
  reason?: string;
  email?: string;
  onSwitchView: SwitchAuthView;
  onSuccess: () => void | Promise<void>;
  onBeforeGoogle: () => void;
}

/**
 * The one sign-in panel (seamless-sign-in D2): a bottom sheet on a phone, a right-hand
 * panel from `md`. Views replace one another in place, so the address bar never
 * changes and a back gesture cannot discard what was typed (R3).
 */
export function AuthSheet({
  open,
  onOpenChange,
  view,
  reason,
  email,
  onSwitchView,
  onSuccess,
  onBeforeGoogle,
}: AuthSheetProps) {
  // Only read while open, which is only ever in the browser.
  const here = () =>
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Only the heart gives a reason; without one, the explicit undefined tells Radix there is no description. */}
      <SheetContent
        side="adaptive"
        {...(reason ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <SheetTitle>{SHEET_TITLES[view]}</SheetTitle>
            {reason && <SheetDescription>{reason}</SheetDescription>}
          </div>
          <SheetClose
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </SheetClose>
        </div>

        {/* Keyed by view and email: D4's fallback must land on a fresh form with the email in. */}
        {view === "signin" && (
          <SignInForm
            key={`signin-${email ?? ""}`}
            defaultEmail={email}
            onSuccess={onSuccess}
            onSwitchView={onSwitchView}
            googleCallbackUrl={open ? here() : "/"}
            onBeforeGoogle={onBeforeGoogle}
          />
        )}
        {view === "signup" && (
          <SignUpForm
            onSuccess={onSuccess}
            onSwitchView={onSwitchView}
            googleCallbackUrl={open ? here() : "/"}
            onBeforeGoogle={onBeforeGoogle}
          />
        )}
        {view === "forgot" && (
          <ForgotPasswordForm
            onSwitchView={onSwitchView}
            defaultEmail={email}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
