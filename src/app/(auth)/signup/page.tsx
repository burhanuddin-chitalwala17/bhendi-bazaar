"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";
import { useServerForm } from "@/hooks/core/useServerForm";
import { readApiError } from "@/lib/api-error";
import { signupSchema, type SignupInput } from "@/lib/validation/schemas/auth.schemas";

export default function SignUpPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  // The same schema the route parses (Invariant 4): password rules show inline as
  // the user types them, and a server detail — a taken email — lands on its field.
  const {
    register,
    onSubmit: handleFormSubmit,
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

      // Auto sign-in after successful signup
      const result = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
      });
      if (result?.error) {
        // Account was created, but auto sign-in failed; direct user to sign-in page.
        router.push("/signin");
        return;
      }
      router.push("/");
    },
    defaultValues: { name: "", email: "", password: "" },
  });

  async function handleGoogleSignUp() {
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground/80">
          Sign up
        </p>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Join the Bhendi Bazaar circle
        </h1>
        <p className="text-xs text-muted-foreground">
          Create an account to save your details and track your orders. You can
          still complete purchases as a guest anytime.
        </p>
      </header>

      <form onSubmit={handleFormSubmit} className="space-y-3 text-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            Name
          </label>
          <Input autoComplete="name" {...register("name")} />
          {errors.name && (
            <p className="text-[0.7rem] text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            Email
          </label>
          <Input type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="text-[0.7rem] text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              className="pr-10" // Add padding for the icon
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
            <p className="text-[0.7rem] text-destructive">{errors.password.message}</p>
          )}
        </div>

        {formError && <p className="text-[0.7rem] text-destructive">{formError}</p>}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full rounded-full text-xs font-semibold uppercase tracking-[0.2em]"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>

        <div className="flex items-center gap-2 pt-2">
          <span className="h-px flex-1 bg-border/70" />
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
            or
          </span>
          <span className="h-px flex-1 bg-border/70" />
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignUp}
          className="w-full rounded-full text-xs font-semibold uppercase tracking-[0.2em]"
        >
          Continue with Google
        </Button>

        <p className="pt-2 text-center text-[0.7rem] text-muted-foreground">
          Already have an account?{" "}
          <Link href="/signin" className="underline underline-offset-4">
            Sign in
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
