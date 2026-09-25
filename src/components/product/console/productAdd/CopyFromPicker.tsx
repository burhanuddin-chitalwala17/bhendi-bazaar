"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, FilePlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProductCopyOption } from "@server/catalog/admin.product.types";

interface CopyFromPickerProps {
  options: ProductCopyOption[];
  /** The product currently copied from, if any — marked, and offered a way back to blank. */
  selectedId?: string;
  newProductPath: string;
}

/** Case-insensitive match on name or SKU; a blank query matches everything. */
export function matchesCopyQuery(
  option: ProductCopyOption,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    option.name.toLowerCase().includes(needle) ||
    (option.sku?.toLowerCase().includes(needle) ?? false)
  );
}

// Radix moves focus to an item on hover, and a focused item swallows keystrokes for
// its typeahead — so hovering mid-search would stop the search box receiving input.
const keepFocusInSearch = (event: React.PointerEvent) => event.preventDefault();

/**
 * Picking a product navigates to `?copyFrom=<id>` rather than fetching: the page reads
 * the source on the server and scopes it to the org, so no route handler is needed.
 */
export function CopyFromPicker({
  options,
  selectedId,
  newProductPath,
}: CopyFromPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  if (options.length === 0) return null;

  const matches = options.filter((option) => matchesCopyQuery(option, query));

  const onOpenChange = (open: boolean) => {
    if (!open) {
      setQuery("");
      return;
    }
    // The menu focuses itself on open; take focus back once it has.
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Escape still closes the menu; every other key belongs to the search box, not the
    // menu's typeahead. ArrowDown steps into the results, as a combobox would.
    if (event.key === "Escape") return;
    event.stopPropagation();
    if (event.key === "ArrowDown") {
      event.preventDefault();
      contentRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]:not([data-search-exempt])')
        ?.focus();
    }
  };

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Copy />
          Copy from product
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent ref={contentRef} align="end" className="w-80">
        <DropdownMenuLabel>
          Copies description, category, attributes and flags
        </DropdownMenuLabel>
        {/* Sticky so the box stays in reach while a long list scrolls beneath it. */}
        <div className="sticky -top-1 z-10 bg-popover px-1 pb-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Search by name or SKU"
              aria-label="Search products to copy"
              className="pl-9"
            />
          </div>
        </div>
        {selectedId && (
          <>
            <DropdownMenuItem
              data-search-exempt
              onPointerMove={keepFocusInSearch}
              onPointerLeave={keepFocusInSearch}
              onSelect={() => router.push(newProductPath)}
            >
              <FilePlus />
              Start blank instead
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {matches.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No products match &ldquo;{query.trim()}&rdquo;
          </p>
        ) : (
          matches.map((option) => (
            <DropdownMenuItem
              key={option.id}
              onPointerMove={keepFocusInSearch}
              onPointerLeave={keepFocusInSearch}
              onSelect={() =>
                router.push(
                  `${newProductPath}?copyFrom=${encodeURIComponent(option.id)}`,
                )
              }
            >
              <span className="min-w-0 flex-1 truncate">{option.name}</span>
              {option.sku && (
                <span className="font-mono text-xs text-muted-foreground">
                  {option.sku}
                </span>
              )}
              {option.id === selectedId && <Check />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
