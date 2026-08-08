"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
 */
export function PortalSidebar({
  header,
  items,
}: {
  header: React.ReactNode;
  items: PortalNavItem[];
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      {header}

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {items.map(({ title, href, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
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
  );
}
