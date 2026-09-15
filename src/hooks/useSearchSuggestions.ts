// src/hooks/useSearchSuggestions.ts
import { useState, useEffect } from "react";
import type { ProductSuggestion } from "@/domain/product";
import type { Category } from "@/domain/category";
import { useDebounce } from "./core/useDebounce";
import { readApiError } from "@/lib/api-error";

export function useSearchSuggestions(query: string, debounceMs = 300) {
  const debouncedQuery = useDebounce(query, debounceMs);

  const [suggestions, setSuggestions] = useState<{
    products: ProductSuggestion[];
    categories: Category[];
  }>({ products: [], categories: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSuggestions({ products: [], categories: [] });
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`
        );
        if (!response.ok) throw await readApiError(response);
        setSuggestions(await response.json());
      } catch (error) {
        // A failed lookup shows no suggestions, never a stale list: the error body
        // was being stored as state, so the next render read `.products` off it.
        setSuggestions({ products: [], categories: [] });
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [debouncedQuery, debounceMs]);

  return { suggestions, loading };
}