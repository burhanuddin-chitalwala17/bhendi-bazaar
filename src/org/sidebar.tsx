"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, LayoutDashboard, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal on purpose. The org switcher and the signed-in-user header belong to
// org-portal-chrome; this exists so the portal is navigable before that lands.
const NAV = [
  { title: "Dashboard", href: "", icon: LayoutDashboard },
  { title: "Products", href: "/products", icon: Package },
];

export function OrgSidebar({ orgId, orgName }: { orgId: string; orgName: string }) {
  const pathname = usePathname();
  const base = `/org/${orgId}`;

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-6 py-5">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gray-500">
          Organisation
        </p>
        <h2 className="mt-1 truncate text-lg font-semibold text-gray-900" title={orgName}>
          {orgName}
        </h2>
      </div>

      <nav className="flex flex-col gap-1 p-3">
        {NAV.map(({ title, href, icon: Icon }) => {
          const target = `${base}${href}`;
          const active = href === "" ? pathname === base : pathname.startsWith(target);
          return (
            <Link
              key={title}
              href={target}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-emerald-50 font-medium text-emerald-700"
                  : "text-gray-700 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Store
        </Link>
      </div>
    </aside>
  );
}
