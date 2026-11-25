import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { SignOutButton } from "./SignOutButton";
import { PORTAL_COPY } from "./portal-copy";

/**
 * Who is signed in, and the exits — shared by the org portal and the platform admin, so the two
 * panels cannot drift apart on something this basic. Server-rendered: the only interactivity is
 * in the leaves.
 *
 * `storefrontHref` is the shop this panel speaks for: an org's own `/store/<handle>`. On a phone
 * the org portal passes `leading` (its shop switcher) and `search`, and the header becomes the
 * shop's top bar.
 */
export function PortalHeader({
  name,
  email,
  label,
  storefrontHref,
  leading,
  bell,
}: {
  name?: string | null;
  email?: string | null;
  label: string;
  storefrontHref?: string;
  /** Phone only: what the bar is about (the shop switcher). */
  leading?: ReactNode;
  /** The org portal's Needs you bell (notifications-core ux.md); on every width. */
  bell?: ReactNode;
}) {
  const phoneBar = Boolean(leading);
  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-card px-2 md:px-6">
      {leading && <div className="min-w-0 flex-1 md:hidden">{leading}</div>}
      {/* Hidden below md: the label plus a full email cannot fit a phone-width row. */}
      <span className="hidden text-label uppercase text-muted-foreground md:inline">{label}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-4">
        {bell}
        <div className={cn("hidden text-right leading-tight", phoneBar ? "md:block" : "sm:block")}>
          <p className="text-small font-medium text-foreground">{name ?? "Signed in"}</p>
          {email && <p className="hidden text-caption text-muted-foreground md:block">{email}</p>}
        </div>
        <span
          aria-hidden
          className={cn(
            "size-8 items-center justify-center rounded-full bg-primary/15 text-caption font-semibold uppercase text-primary",
            phoneBar ? "hidden md:flex" : "flex",
          )}
        >
          {name?.charAt(0)?.toUpperCase() ?? "U"}
        </span>
        <div className="flex items-center sm:border-l sm:border-border sm:pl-4">
          {storefrontHref && (
            <Link
              prefetch={false}
              href={storefrontHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "min-h-10 items-center rounded-field px-3 text-small text-muted-foreground hover:bg-muted hover:text-foreground",
                phoneBar ? "hidden md:inline-flex" : "inline-flex",
              )}
            >
              {PORTAL_COPY.seeAsBuyer}
            </Link>
          )}
          <SignOutButton compact={phoneBar} />
        </div>
      </div>
    </header>
  );
}
