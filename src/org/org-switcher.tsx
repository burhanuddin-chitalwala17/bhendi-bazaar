"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { useClickOutside } from "@/hooks/useClickOutside";

export interface SwitcherOrg {
  id: string;
  name: string;
  code: string;
  role: string;
}

/** The section of the portal currently open, so switching org keeps you on it. */
const SECTIONS = ["products", "orders", "reviews"];

export function OrgSwitcher({ orgs, currentOrgId }: { orgs: SwitcherOrg[]; currentOrgId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useClickOutside(ref as React.RefObject<HTMLElement>, () => setOpen(false));

  const current = orgs.find((o) => o.id === currentOrgId);
  const section = pathname.split("/")[3];
  const suffix = SECTIONS.includes(section) ? `/${section}` : "";

  return (
    <div ref={ref} className="relative border-b border-border px-3 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted/60"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-2xs uppercase tracking-eyebrow text-muted-foreground">
            Organisation
          </span>
          <span className="block truncate text-lg font-semibold text-foreground" title={current?.name}>
            {current?.name ?? "Organisation"}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground/70" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-20 mt-1 rounded-lg border border-border bg-card p-1 shadow-overlay">
          {orgs.map((org) => (
            <Link
              prefetch={false}
              key={org.id}
              href={`/org/${org.id}${suffix}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/60"
            >
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{org.name}</span>
                <span className="text-xs text-muted-foreground">
                  {org.code} · {org.role.toLowerCase()}
                </span>
              </span>
              {org.id === currentOrgId && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </Link>
          ))}
          <Link
            prefetch={false}
            href="/org/new"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-md border-t border-border/60 px-3 py-2 text-sm text-primary hover:bg-muted/60"
          >
            <Plus className="h-4 w-4" />
            Create another organisation
          </Link>
        </div>
      )}
    </div>
  );
}
