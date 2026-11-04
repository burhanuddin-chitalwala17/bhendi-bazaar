"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { useClickOutside } from "@/hooks/useClickOutside";
import { useSearchSuggestions } from "@/hooks/useSearchSuggestions";
import { useDebounce } from "@/hooks/core/useDebounce";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";

export function NavbarSearch() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(search, 300);
  const { suggestions, loading } = useSearchSuggestions(debouncedSearch);

  useClickOutside(searchRef as React.RefObject<HTMLElement>, () =>
    setShowSuggestions(false),
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
    <div className="relative min-w-0 flex-1 lg:max-w-sm lg:ml-auto" ref={searchRef}>
      <form
        onSubmit={handleSearchSubmit}
        role="search"
        className="flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3"
      >
        <Icon name="search" size="sm" tone="muted" />
        <Input
          type="search"
          aria-label="Search the bazaar"
          placeholder="Search ridas, abayas, shops"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          className="h-8 border-0 bg-transparent p-0 focus-visible:ring-0"
        />
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && search.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border/70 rounded-card shadow-overlay z-50 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-small text-muted-foreground">
              <Spinner size="sm" />
              Searching
            </div>
          ) : (
            <>
              {suggestions.products.length > 0 && (
                <div className="p-2">
                  <p className="px-3 py-2 text-label uppercase text-muted-foreground">
                    Products
                  </p>
                  {suggestions.products.map((product) => (
                    <Link
                      prefetch={false}
                      key={product.id}
                      href={`/product/${product.slug}`}
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearch("");
                      }}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg"
                    >
                      <Image
                        src={product.thumbnail}
                        alt={product.name}
                        width={40}
                        height={53}
                        sizes="40px"
                        className="aspect-3/4 w-10 rounded object-cover"
                      />
                      <div>
                        <p className="text-small font-medium">{product.name}</p>
                        <PriceDisplay
                          price={product.price}
                          salePrice={product.salePrice}
                          size="xs"
                          showBadge={false}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {suggestions.categories.length > 0 && (
                <div className="p-2 border-t border-border/70">
                  <p className="px-3 py-2 text-label uppercase text-muted-foreground">
                    Categories
                  </p>
                  {suggestions.categories.map((category) => (
                    <Link
                      prefetch={false}
                      key={category.slug}
                      href={`/category/${category.slug}`}
                      onClick={() => {
                        setShowSuggestions(false);
                        setSearch("");
                      }}
                      className="block px-3 py-2 hover:bg-muted rounded-lg text-small"
                    >
                      {category.name}
                    </Link>
                  ))}
                </div>
              )}

              <div className="p-2 border-t border-border/70">
                <Button
                  variant="ghost"
                  onClick={handleSearchSubmit}
                  className="w-full justify-start text-left text-primary"
                >
                  See all results for &quot;{search}&quot;
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
