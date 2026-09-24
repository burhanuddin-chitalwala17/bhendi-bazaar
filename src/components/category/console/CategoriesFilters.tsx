"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** The category search, held in the URL so the server can answer it ([ADR-0034]). */
export function CategoriesFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  const apply = () => {
    const next = new URLSearchParams(params.toString());
    if (search) next.set("search", search);
    else next.delete("search");
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        placeholder="Search categories..."
        className="flex-1"
      />
      <Button variant="default" onClick={apply} className="flex items-center gap-2">
        <Search className="size-4" />
        Search
      </Button>
    </div>
  );
}
