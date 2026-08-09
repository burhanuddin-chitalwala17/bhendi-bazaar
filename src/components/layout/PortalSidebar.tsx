"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PortalNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Match this href exactly (dashboards), rather than as a prefix (sections). */
  exact?: boolean;
}

/**
 * The one sidebar shell both portals use — header slot, nav, and Back to Store pinned
 * to the bottom. The admin and org sidebars are configurations of this, not siblings
 * of it, so they cannot drift on structure.
 *
 * Below md it is an off-canvas drawer behind a fixed hamburger; a 256px fixed column
 * left ~118px of content on a phone.
 */
export function PortalSidebar({
  header,
  items,
}: {
  header: React.ReactNode;
  items: PortalNavItem[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        className="fixed left-3 top-2.5 z-40 flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-scrim/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-card transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground md:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {header}

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map(({ title, href, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground/80 hover:bg-muted/60"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back to Store
          </Link>
        </div>
      </aside>
    </>
  );
}
