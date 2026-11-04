"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PLATFORM_ROLE } from "@server/identity/admin.user.types";

/**
 * The console's user filters, held in the URL rather than in component state.
 *
 * The page is a server component ([ADR-0034]), so a filter change has to be a navigation for
 * the server to re-read — which is the better answer anyway: a filtered view becomes
 * shareable, bookmarkable, and survives the back button, none of which `useState` gives.
 */
export function UsersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  /** Any filter change resets to page 1 — page 3 of a different result set is meaningless. */
  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply({ search })}
          placeholder="Search by name, email or mobile…"
          aria-label="Search users"
        />
        <Button
          variant="default"
          onClick={() => apply({ search })}
          className="flex items-center gap-2"
        >
          <Icon name="search" />
          Search
        </Button>
      </div>

      <Select
        value={params.get("platformRole") ?? ""}
        onChange={(e) => apply({ platformRole: e.target.value })}
      >
        <option value="">All roles</option>
        <option value={PLATFORM_ROLE.USER}>User</option>
        <option value={PLATFORM_ROLE.ADMIN}>Admin</option>
      </Select>

      <Select
        value={params.get("isBlocked") ?? ""}
        onChange={(e) => apply({ isBlocked: e.target.value })}
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="blocked">Blocked</option>
      </Select>
    </div>
  );
}
