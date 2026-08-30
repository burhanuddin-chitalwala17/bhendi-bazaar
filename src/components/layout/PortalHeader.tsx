import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

/**
 * Who is signed in, and the two exits — shared by the org portal and the platform
 * admin, so the two panels cannot drift apart on something this basic. Server-rendered:
 * the only interactivity is the sign-out leaf.
 */
export function PortalHeader({
  name,
  email,
  label,
}: {
  name?: string | null;
  email?: string | null;
  label: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6">
      {/* Hidden below md: the drawer hamburger occupies the top-left, and the label
          plus a full email cannot fit a phone-width row anyway. */}
      <span className="hidden text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground md:inline">
        {label}
      </span>
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium text-foreground">{name ?? "Signed in"}</p>
          {email && <p className="hidden text-xs text-muted-foreground md:block">{email}</p>}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold uppercase text-primary">
          {name?.charAt(0)?.toUpperCase() ?? "U"}
        </span>
        <div className="flex items-center border-l border-border pl-2 sm:pl-4">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Storefront
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
