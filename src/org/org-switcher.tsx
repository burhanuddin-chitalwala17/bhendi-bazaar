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

  // One org: nothing to switch between, so no control pretending otherwise —
  // the name is a heading, with creation still reachable below.
  if (orgs.length <= 1) {
    return (
      <div className="border-b border-gray-200 px-6 py-5">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-500">Organisation</p>
        <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={current?.name}>
          {current?.name ?? "Organisation"}
        </h2>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative border-b border-gray-200 px-3 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left hover:bg-gray-50"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block text-[0.7rem] uppercase tracking-[0.18em] text-gray-500">
            Organisation
          </span>
          <span className="block truncate text-lg font-semibold text-gray-900" title={current?.name}>
            {current?.name ?? "Organisation"}
          </span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-20 mt-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/org/${org.id}${suffix}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Building2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{org.name}</span>
                <span className="text-xs text-muted-foreground">
                  {org.code} · {org.role.toLowerCase()}
                </span>
              </span>
              {org.id === currentOrgId && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
            </Link>
          ))}
          <Link
            href="/org/new"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-md border-t border-gray-100 px-3 py-2 text-sm text-emerald-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            Create another organisation
          </Link>
        </div>
      )}
    </div>
  );
}
