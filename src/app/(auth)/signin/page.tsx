"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/shared/GoogleIcon";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { loginSchema, type LoginInput } from "@/lib/validation/schemas/auth.schemas";

export default function SignInPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  // The same schema the credentials provider validates with; next-auth reports a
  // single failure, which lands as the form-level error (ADR-0013).
  const {
    register,
    onSubmit: handleFormSubmit,
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
      if (result?.error) {
        throw new Error("Invalid email or password.");
      }
      router.push("/");
    },
    defaultValues: { email: "", password: "" },
  });

  async function handleGoogleSignIn() {
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1 text-center">
        <p className="text-2xs font-semibold uppercase tracking-display text-muted-foreground/80">
          Sign in
        </p>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Welcome back to Bhendi Bazaar
        </h1>
        <p className="text-xs text-muted-foreground">
          Sign in to see your orders and enjoy a faster checkout. You can still
          shop as a guest without an account.
        </p>
      </header>

      <form onSubmit={handleFormSubmit} className="space-y-3 text-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-eyebrow">
            Email
          </label>
          <Input type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="text-2xs text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-eyebrow">
            Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="pr-10" // Add padding for the icon
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-2xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            prefetch={false}
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {formError && <p className="text-2xs text-destructive">{formError}</p>}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
        <div className="flex items-center gap-2 pt-2">
          <span className="h-px flex-1 bg-border/70" />
          <span className="text-2xs uppercase tracking-eyebrow text-muted-foreground">
            or
          </span>
          <span className="h-px flex-1 bg-border/70" />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignIn}
          className="w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow"
        >
          <GoogleIcon />
          Continue with Google
        </Button>
        <p className="pt-2 text-center text-2xs text-muted-foreground">
          New to Bhendi Bazaar?{" "}
          <Link href="/signup" className="underline underline-offset-4" prefetch={false}>
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
