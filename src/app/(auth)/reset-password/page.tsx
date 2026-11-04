/**
 * Set a new password from an emailed link — a server component ([ADR-0034]).
 *
 * The token is read from `searchParams` here rather than from `useSearchParams` in the browser,
 * which is what made this a client page. A link with no token never reaches the form.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { RESET_PAGE_COPY } from "@/components/auth/auth-copy";
import { ROUTES } from "@server/shared/routes";

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
        <h1 className="text-title font-semibold">{RESET_PAGE_COPY.invalidTitle}</h1>
        <p className="text-muted-foreground">{RESET_PAGE_COPY.invalidBody}</p>
        <Link href={ROUTES.forgotPassword} prefetch={false}>
          <Button>{RESET_PAGE_COPY.requestNew}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-2xs font-semibold uppercase tracking-display text-muted-foreground/80">
          {RESET_PAGE_COPY.eyebrow}
        </p>
        <h1 className="font-heading text-title font-semibold tracking-tight">
          {RESET_PAGE_COPY.title}
        </h1>
        <p className="text-caption text-muted-foreground">{RESET_PAGE_COPY.description}</p>
      </header>

      <ResetPasswordForm token={value} />
    </div>
  );
}
