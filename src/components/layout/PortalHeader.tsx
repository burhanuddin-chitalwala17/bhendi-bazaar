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
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      <span className="text-[0.7rem] font-medium uppercase tracking-[0.18em] text-gray-500">
        {label}
      </span>
      <div className="flex items-center gap-4">
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-gray-900">{name ?? "Signed in"}</p>
          {email && <p className="text-xs text-muted-foreground">{email}</p>}
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold uppercase text-emerald-700">
          {name?.charAt(0)?.toUpperCase() ?? "U"}
        </span>
        <div className="flex items-center border-l border-gray-200 pl-4">
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            Storefront
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
