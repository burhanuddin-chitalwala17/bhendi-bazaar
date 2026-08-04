// NEW: components/layout/navbar/CategoriesDropdown.tsx

"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { categoryApiClient } from "@/services/categoryApiClient";
import { LoadingSpinner } from "@/components/shared/states/LoadingSpinner";
import { usePathname } from "next/navigation";

export function CategoriesDropdown() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const { data: categories, loading } = useAsyncData(() =>
    categoryApiClient.getCategories()
  );

  useClickOutside(dropdownRef as React.RefObject<HTMLElement>, () =>
    setOpen(false)
  );

  // Find the currently selected category based on pathname
  const selectedCategory = useMemo(() => {
    if (!categories || !pathname.startsWith("/category/")) {
      return null;
    }

    // Extract slug from pathname: /category/[slug]
    const slug = pathname.split("/category/")[1]?.split("/")[0];
    return categories.find((cat) => cat.slug === slug);
  }, [categories, pathname]);

  // Button label: show selected category name or "Categories"
  const buttonLabel = selectedCategory?.name || "Categories";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
      >
        {buttonLabel}
        <span className="text-[0.6rem] leading-none">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-2 w-52 rounded-xl border border-border/70 bg-popover/95 p-1 text-xs shadow-lg">
          {loading ? (
            <div className="flex justify-center p-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            categories?.map((category) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {category.name}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}