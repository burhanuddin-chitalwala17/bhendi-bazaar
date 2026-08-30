"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useProfileContext } from "@/context/ProfileContext";
import { ShieldAlert } from "lucide-react";

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const user = session?.user;
  const { isEmailVerified } = useProfileContext(); // ✨ Only use for email verification

  useClickOutside(dropdownRef as React.RefObject<HTMLElement>, () =>
    setOpen(false)
  );

  async function handleLogout() {
    console.log("Logout clicked");
    // Clear session without navigating to the NextAuth signout page
    await signOut({ redirect: false });
    console.log("Session cleared");
    // Close the menu and refresh UI
    setOpen(false);
    router.push("/"); // optional: send them home
    router.refresh(); // ensures any session-dependent UI re-renders
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card/80 text-xs font-semibold uppercase tracking-label relative"
      >
        {user?.name?.charAt(0)?.toUpperCase() ?? "B"}
        {!isEmailVerified && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-warning rounded-full border-2 border-background" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border/70 bg-popover/95 p-2 text-xs shadow-overlay">
          <Link
            href="/profile"
            onClick={() => {
              setOpen(false);
            }}
            className="mb-2 border-b border-border/70 pb-2 block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <p className="font-semibold">{user?.name}</p>
            {user?.email && (
              <p className="text-2xs text-muted-foreground">
                {user?.email}
              </p>
            )}
            {!isEmailVerified && (
              <div className="mt-2 flex items-center gap-1.5 text-warning dark:text-warning">
                <ShieldAlert className="h-3 w-3" />
                <span className="text-2xs font-medium">
                  Email not verified
                </span>
              </div>
            )}
          </Link>
          <Link
            href="/orders"
            onClick={() => {
              setOpen(false);
            }}
            className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Orders
          </Link>
          <Link
            href="/org"
            onClick={() => {
              setOpen(false);
            }}
            className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Org Portal
          </Link>
          <button
            type="button"
            className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
