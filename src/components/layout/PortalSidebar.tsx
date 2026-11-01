"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface PortalNavItem {
  title: string;
  /** Absent for an item that runs `onSelect` instead of opening a page. */
  href?: string;
  icon: LucideIcon;
  /** Match this href exactly (dashboards), rather than as a prefix (sections). */
  exact?: boolean;
  /** One line under the title (own-store onboarding R5). */
  purpose?: string;
  /** Work waiting there, shown beside the title; nothing is shown for zero or absent. */
  count?: number;
  /** Set by a caller that decides "current" itself, rather than by href matching. */
  active?: boolean;
  onSelect?: () => void;
}

/** A labelled run of items; the org portal's five groups (own-store onboarding D1). */
export interface PortalNavGroup {
  label?: string;
  items: PortalNavItem[];
}

/**
 * The one sidebar shell both portals use — header slot, nav, and Back to Store pinned
 * to the bottom. The admin and org sidebars are configurations of this, not siblings
 * of it, so they cannot drift on structure.
 *
 * Below md it is an off-canvas drawer. The admin opens it from a fixed hamburger; the org
 * portal passes `open` from its tab bar's More and anchors it to the bottom, with an icon
 * rail at md and the full list from lg (own-store onboarding D2, Q10, Q28).
 */
export function PortalSidebar({
  header,
  items,
  groups,
  open: controlledOpen,
  onOpenChange,
  anchor = "left",
}: {
  header: React.ReactNode;
  items?: PortalNavItem[];
  groups?: PortalNavGroup[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchor?: "left" | "bottom";
}) {
  const pathname = usePathname();
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (!controlled) setOwnOpen(next);
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );
  const bottom = anchor === "bottom";
  const sections: PortalNavGroup[] = groups ?? [{ items: items ?? [] }];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <>
      {!bottom && (
        <Button
          variant="outline"
          size="icon"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="fixed left-3 top-2.5 z-40 flex h-9 w-9 items-center justify-center border-border bg-card text-foreground md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40 bg-scrim/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label={bottom ? "More" : undefined}
        className={cn(
          "fixed z-50 flex shrink-0 flex-col border-border bg-card transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 md:translate-y-0 md:border-r",
          bottom
            ? cn(
                "inset-x-0 bottom-0 max-h-overlay rounded-t-card border-t pb-safe md:inset-x-auto md:bottom-auto md:max-h-none md:w-16 md:rounded-none md:border-t-0 md:pb-0 lg:w-64",
                open ? "translate-y-0" : "translate-y-full",
              )
            : cn("inset-y-0 left-0 w-64 border-r", open ? "translate-x-0" : "-translate-x-full"),
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground md:hidden"
        >
          <X className="h-5 w-5" />
        </Button>

        <div className={cn(bottom && "md:hidden lg:block")}>{header}</div>

        {/* Scrolls inside the sticky aside; overscroll-contain stops the page scrolling once the list ends. */}
        <nav className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4", bottom ? "space-y-4 md:px-2 lg:px-4" : "space-y-1")}>
          {sections.map((section, index) => (
            <div key={section.label ?? index} className="space-y-1">
              {section.label && (
                <p className="px-4 text-2xs font-medium uppercase tracking-eyebrow text-muted-foreground md:sr-only lg:not-sr-only">
                  {section.label}
                </p>
              )}
              {section.items.map((item) => (
                <PortalNavLink
                  key={item.href ?? item.title}
                  item={item}
                  rail={bottom}
                  active={item.active ?? isHrefActive(item, pathname)}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          ))}
        </nav>

        <div className={cn("border-t border-border p-4", bottom && "md:hidden lg:block")}>
          <Link
            prefetch={false}
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

function isHrefActive(item: PortalNavItem, pathname: string): boolean {
  if (!item.href) return false;
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * One row. In the rail (org portal at md) the label is visually hidden but still the link's
 * name, and the browser's own tooltip shows it on hover: a drawn label would be clipped by the
 * rail, which scrolls.
 */
function PortalNavLink({
  item,
  rail,
  active,
  onNavigate,
}: {
  item: PortalNavItem;
  rail: boolean;
  active: boolean;
  onNavigate: () => void;
}) {
  const { title, href, icon: Icon, purpose, onSelect, count } = item;
  const tone = active ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted/60";
  const body = (
    <>
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className={cn("min-w-0 text-left", rail && "md:sr-only lg:not-sr-only")}>
        <span className="block">{title}</span>
        {purpose && <span className="block text-xs font-normal text-muted-foreground">{purpose}</span>}
      </span>
      {count ? (
        <span className={cn("ml-auto rounded-full bg-primary/10 px-2 text-xs font-medium tabular-nums text-primary", rail && "md:hidden lg:inline")}>
          {count}
        </span>
      ) : null}
    </>
  );
  const rowClass = cn(
    "relative flex min-h-11 w-full items-center gap-3 rounded-field px-4 py-2 transition-colors",
    rail && "md:justify-center md:px-0 lg:justify-start lg:px-4",
    tone,
  );

  if (!href) {
    return (
      <Button
        variant="ghost"
        type="button"
        onClick={() => {
          onNavigate();
          onSelect?.();
        }}
        title={rail ? title : undefined}
        className={cn(rowClass, "h-auto justify-start whitespace-normal font-normal")}
      >
        {body}
      </Button>
    );
  }
  return (
    <Link
      prefetch={false}
      href={href}
      aria-current={active ? "page" : undefined}
      title={rail ? title : undefined}
      onClick={() => {
        onNavigate();
        onSelect?.();
      }}
      className={rowClass}
    >
      {body}
    </Link>
  );
}
