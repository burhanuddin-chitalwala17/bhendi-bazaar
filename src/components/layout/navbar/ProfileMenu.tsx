"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const user = session?.user;
  // Rides the session token (see auth-config.ts) — no /api/profile fetch for a badge.
  const isEmailVerified = session?.user?.isEmailVerified ?? true;

  useClickOutside(dropdownRef as React.RefObject<HTMLElement>, () =>
    setOpen(false),
  );

  async function handleLogout() {
    // Without redirect, so the NextAuth sign-out page never shows; refresh re-renders session-dependent UI.
    await signOut({ redirect: false });
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        shape="icon"
        type="button"
        onClick={() => setOpen((v) => !v)}
        size="lg"
        aria-label="Your account"
        aria-expanded={open}
        className="relative rounded-full text-caption font-semibold uppercase"
      >
        {user?.name?.charAt(0)?.toUpperCase() ?? "B"}
        {!isEmailVerified && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-warning rounded-full border-2 border-background" />
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-card border border-border bg-popover p-2 text-small shadow-overlay">
          <Link
            prefetch={false}
            href="/profile"
            onClick={() => {
              setOpen(false);
            }}
            className="mb-2 border-b border-border/70 pb-2 block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <p className="font-semibold">{user?.name}</p>
            {user?.email && (
              <p className="text-2xs text-muted-foreground">{user?.email}</p>
            )}
            {!isEmailVerified && (
              <div className="mt-2 flex items-center gap-1.5 text-warning dark:text-warning">
                <Icon name="security-warning" size="xs" />
                <span className="text-2xs font-medium">Email not verified</span>
              </div>
            )}
          </Link>
          <Link
            prefetch={false}
            href="/orders"
            onClick={() => {
              setOpen(false);
            }}
            className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Orders
          </Link>
          <Link
            prefetch={false}
            href="/wishlist"
            onClick={() => {
              setOpen(false);
            }}
            className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Saved
          </Link>
          <Link
            prefetch={false}
            href="/org"
            onClick={() => {
              setOpen(false);
            }}
            className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Your shop
          </Link>
          <Button
            variant="ghost"
            type="button"
            className="mt-1 w-full justify-start text-left text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
