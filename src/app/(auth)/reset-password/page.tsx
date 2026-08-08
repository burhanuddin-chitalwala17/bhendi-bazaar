"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link");
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
      
      // Redirect to signin after 3 seconds
      setTimeout(() => {
        router.push("/signin");
      }, 3000);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            New Password
          </label>
          <Input
            type={showPasswords ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="text-[0.65rem] text-muted-foreground">
            At least 8 characters with uppercase, lowercase, and numbers
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            Confirm Password
          </label>
          <Input
            type={showPasswords ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
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

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
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