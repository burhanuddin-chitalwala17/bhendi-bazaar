"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LoadingSpinner } from "@/components/shared/states/LoadingSpinner";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { categoryApiClient } from "@/services/categoryApiClient";
import { CATEGORY_ACCENTS } from "@/lib/category-accent";
import { cn } from "@/lib/utils";

/** The phone's category browser, opened from the tab bar. Radix unmounts sheet
 *  content while closed, so the list below — and its fetch — only exist once the
 *  shopper asks for it. */
export function CategorySheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>Shop by lane</SheetTitle>
        <CategorySheetList onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}

function CategorySheetList({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { data: categories, loading } = useAsyncData(() =>
    categoryApiClient.getCategories()
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {categories?.map((category) => {
        const href = `/category/${category.slug}`;
        return (
          <Link
            key={category.slug}
            href={href}
            onClick={onNavigate}
            className={cn(
              "relative flex min-h-16 items-end overflow-hidden rounded-lg border border-border/70 p-3",
              pathname === href && "border-primary ring-2 ring-ring/30"
            )}
          >
            <span
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-br",
                CATEGORY_ACCENTS[category.accent].heroGradient
              )}
            />
            <span className="relative font-heading text-sm font-semibold leading-tight text-hero-foreground">
              {category.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
