"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send reset email");
        return;
      }

      setSuccess(true);
      setEmail("");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

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
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground/80">
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
        <div className="space-y-4 rounded-lg border border-green-200 bg-green-50 p-6 text-center">
          <Mail className="mx-auto h-12 w-12 text-green-600" />
          <div className="space-y-2">
            <h3 className="font-semibold text-green-900">Check Your Email</h3>
            <p className="text-sm text-green-700">
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.18em]">
              Email Address
            </label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full text-xs font-semibold uppercase tracking-[0.2em]"
          >
            {isSubmitting ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>
      )}
    </div>
  );
}