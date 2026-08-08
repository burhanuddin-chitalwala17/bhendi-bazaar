"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff } from "lucide-react";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    setIsLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/");
  }

  async function handleGoogleSignIn() {
    setError(null);
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-muted-foreground/80">
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

      <form onSubmit={handleSubmit} className="space-y-3 text-sm">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            Email
          </label>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-[0.18em]">
            Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-10" // Add padding for the icon
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
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        {error && <p className="text-[0.7rem] text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={isLoading}
          className="mt-2 w-full rounded-full text-xs font-semibold uppercase tracking-[0.2em]"
        >
          {isLoading ? "Signing in..." : "Sign in"}
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
          onClick={handleGoogleSignIn}
          className="w-full rounded-full text-xs font-semibold uppercase tracking-[0.2em]"
        >
          Continue with Google
        </Button>
        <p className="pt-2 text-center text-[0.7rem] text-muted-foreground">
          New to Bhendi Bazaar?{" "}
          <Link href="/signup" className="underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
