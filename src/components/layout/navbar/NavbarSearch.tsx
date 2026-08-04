// NEW: components/layout/navbar/NavbarSearch.tsx

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useDebounce } from "@/hooks/core/useDebounce";

export function NavbarSearch() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { suggestions, loading } = useSearchSuggestions(debouncedSearch);

  useClickOutside(searchRef as React.RefObject<HTMLElement>, () =>
    setShowSuggestions(false)
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/s?q=${encodeURIComponent(q)}`);
    setSearch("");
    setShowSuggestions(false);
  }

  return (
    <div className="relative flex-1" ref={searchRef}>
      <form
        onSubmit={handleSearchSubmit}
        className="flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search the bazaar…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="h-7 border-0 bg-transparent p-0 text-xs focus-visible:ring-0"
        />
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && search.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border/70 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : (
            <>
              {suggestions.products.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Products
                  </p>
                  {suggestions.products.map((product) => (
                    <Link
                      key={product.id}
                      href={`/product/${product.slug}`}
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearch("");
                      }}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg"
                    >
                      <img
                        src={product.thumbnail}
                        alt={product.name}
                        className="w-10 aspect-[3/4] object-cover rounded"
                      />
                      <div>
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.currency} {product.price}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {suggestions.categories.length > 0 && (
                <div className="p-2 border-t border-border/70">
                  <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Categories
                  </p>
                  {suggestions.categories.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/category/${category.slug}`}
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearch("");
                      }}
                      className="block px-3 py-2 hover:bg-muted rounded-lg text-sm"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}

              <div className="p-2 border-t border-border/70">
                <button
                  onClick={handleSearchSubmit}
                  className="w-full px-3 py-2 text-sm text-primary hover:bg-muted rounded-lg text-left"
                >
                  See all results for &quot;{search}&quot;
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}