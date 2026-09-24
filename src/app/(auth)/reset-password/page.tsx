/**
 * Set a new password from an emailed link — a server component ([ADR-0034]).
 *
 * The token is read from `searchParams` here rather than from `useSearchParams` in the browser,
 * which is what made this a client page. A link with no token never reaches the form.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;

  if (!value) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold">Invalid reset link</h1>
        <p className="text-muted-foreground">
          This password reset link is invalid or has expired.
        </p>
        <Link href="/forgot-password" prefetch={false}>
          <Button>Request new link</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-2xs font-semibold uppercase tracking-display text-muted-foreground/80">
          Reset password
        </p>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Create new password
        </h1>
        <p className="text-xs text-muted-foreground">Enter your new password below.</p>
      </header>

      <ResetPasswordForm token={value} />
    </div>
  );
}
