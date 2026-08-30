"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Mail } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validation/schemas/auth.schemas";

export default function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false);

  const {
    register,
    onSubmit: handleFormSubmit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerForm<ForgotPasswordInput>({
    schema: forgotPasswordSchema,
    submit: async (data) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw await readApiError(response);
      setSuccess(true);
    },
    defaultValues: { email: "" },
  });

  return (
    <div className="space-y-6">
      <Link
        href="/signin"
        className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-3 w-3" />
        Back to sign in
      </Link>

      <header className="space-y-1">
        <p className="text-2xs font-semibold uppercase tracking-display text-muted-foreground/80">
          Forgot Password
        </p>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Reset Your Password
        </h1>
        <p className="text-xs text-muted-foreground">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </header>

      {success ? (
        <div className="space-y-4 rounded-lg border border-success/30 bg-success/10 p-6 text-center">
          <Mail className="mx-auto h-12 w-12 text-success" />
          <div className="space-y-2">
            <h3 className="font-semibold text-success">Check Your Email</h3>
            <p className="text-sm text-success">
              If an account exists with this email, you&apos;ll receive a password
              reset link shortly.
            </p>
          </div>
          <Link href="/signin">
            <Button variant="outline" className="mt-4">
              Return to Sign In
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-eyebrow">
              Email Address
            </label>
            <Input
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-2xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {formError && (
            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      )}
    </div>
  );
}
