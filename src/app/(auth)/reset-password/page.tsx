"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validation/schemas/auth.schemas";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [showPasswords, setShowPasswords] = useState(false);
  const [success, setSuccess] = useState(false);

  // The token rides in the schema, so an expired link's server error surfaces the
  // same way a weak password does; the mismatch refine lands on confirmPassword.
  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<ResetPasswordInput>({
    schema: resetPasswordSchema,
    submit: async (data) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await readApiError(response);
      setSuccess(true);
      // Redirect to signin after 3 seconds
      setTimeout(() => {
        router.push("/signin");
      }, 3000);
    },
    defaultValues: { token: token ?? "", password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">Invalid Reset Link</h1>
        <p className="text-muted-foreground">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password">
          <Button>Request New Link</Button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4 rounded-lg border border-success/30 bg-success/10 p-6 text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-success" />
        <div className="space-y-2">
          <h3 className="font-semibold text-success">Password Reset Successfully!</h3>
          <p className="text-sm text-success">
            Your password has been changed. Redirecting to sign in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground/80">
          Reset Password
        </p>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Create New Password
        </h1>
        <p className="text-xs text-muted-foreground">
          Enter your new password below.
        </p>
      </header>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <input type="hidden" {...register("token")} />
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            New Password
          </label>
          <Input
            type={showPasswords ? "text" : "password"}
            autoComplete="new-password"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-[0.7rem] text-destructive">{errors.password.message}</p>
          ) : (
            <p className="text-[0.65rem] text-muted-foreground">
              At least 8 characters with uppercase, lowercase, a number and a symbol
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            Confirm Password
          </label>
          <Input
            type={showPasswords ? "text" : "password"}
            autoComplete="new-password"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-[0.7rem] text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowPasswords(!showPasswords)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {showPasswords ? (
            <>
              <EyeOff className="h-3 w-3" /> Hide passwords
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Show passwords
            </>
          )}
        </button>

        {(formError || errors.token) && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {formError ?? errors.token?.message}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full text-xs font-semibold uppercase tracking-[0.2em]"
        >
          {isSubmitting ? "Resetting..." : "Reset Password"}
        </Button>
      </form>
    </div>
  );
}
