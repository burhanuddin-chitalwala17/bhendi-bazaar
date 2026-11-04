"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClickOutside } from "@/hooks/useClickOutside";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface SwitcherOrg {
  id: string;
  name: string;
  /** Its public shop address, `/store/<handle>` — the portal header links there. */
  handle: string;
  role: string;
}

/** The section of the portal currently open, so switching org keeps you on it. */
const SECTIONS = ["products", "orders", "reviews", "earnings"];

/**
 * Which shop the portal is working on. `sidebar` heads the desktop list; `bar` is the phone's top
 * bar: the shop's initial and name, opening the same list.
 */
export function OrgSwitcher({
  orgs,
  currentOrgId,
  variant = "sidebar",
}: {
  orgs: SwitcherOrg[];
  currentOrgId: string;
  variant?: "sidebar" | "bar";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useClickOutside(ref as React.RefObject<HTMLElement>, () => setOpen(false));

  const current = orgs.find((o) => o.id === currentOrgId);
  const name = current?.name ?? "Shop";
  const section = pathname.split("/")[3];
  const suffix = SECTIONS.includes(section) ? `/${section}` : "";
  const bar = variant === "bar";

  return (
    <div ref={ref} className={cn("relative", bar ? "min-w-0" : "border-b border-border px-3 py-4")}>
      <Button
        variant="ghost"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={bar ? `Shop: ${name}. Switch shop` : undefined}
        className={cn(
          "flex h-auto min-h-11 items-center gap-2 whitespace-normal text-left hover:bg-muted/60",
          bar ? "max-w-full justify-start px-1" : "w-full justify-between",
        )}
      >
        {bar ? (
          <>
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-small font-semibold uppercase text-primary-foreground">
              {name.charAt(0)}
            </span>
            <span className="min-w-0 truncate text-body font-semibold text-foreground">{name}</span>
          </>
        ) : (
          <span className="min-w-0">
            <span className="block text-label uppercase text-muted-foreground">Shop</span>
            <span className="block truncate text-title font-semibold text-foreground" title={current?.name}>
              {name}
            </span>
          </span>
        )}
        <Icon name={bar ? "expand" : "choose"} size="sm" tone="muted" />
      </Button>

      {open && (
        <div className={cn("absolute z-50 mt-1 rounded-card border border-border bg-card p-1 shadow-overlay", bar ? "left-0 w-72 max-w-full" : "left-3 right-3")}>
          {orgs.map((org) => (
            <Link
              prefetch={false}
              key={org.id}
              href={`/org/${org.id}${suffix}`}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center gap-2 rounded-field px-3 py-2 text-small hover:bg-muted/60"
            >
              <Icon name="shop" size="sm" tone="primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{org.name}</span>
                <span className="text-caption text-muted-foreground">{org.role.toLowerCase()}</span>
              </span>
              {org.id === currentOrgId && <Icon name="done" size="sm" tone="primary" label="Current shop" />}
            </Link>
          ))}
          <Link
            prefetch={false}
            href="/org/new"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center gap-2 rounded-field border-t border-border/60 px-3 py-2 text-small text-primary hover:bg-muted/60"
          >
            <Icon name="add" size="sm" />
            Open another shop
          </Link>
        </div>
      )}
    </div>
  );
}
