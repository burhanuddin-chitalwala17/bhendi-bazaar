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
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-foreground">{name ?? "Signed in"}</p>
          {email && <p className="text-xs text-muted-foreground">{email}</p>}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold uppercase text-primary">
          {name?.charAt(0)?.toUpperCase() ?? "U"}
        </span>
        <div className="flex items-center border-l border-border pl-4">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Storefront
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
