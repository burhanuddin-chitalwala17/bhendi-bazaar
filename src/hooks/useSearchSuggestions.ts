// src/hooks/useSearchSuggestions.ts
import { useState, useEffect } from "react";
import { useDebounce } from "./core/useDebounce";
import { searchApiClient, type SearchSuggestions } from "@/components/product/searchApiClient";

export function useSearchSuggestions(query: string, debounceMs = 300) {
  const debouncedQuery = useDebounce(query, debounceMs);

  const [suggestions, setSuggestions] = useState<SearchSuggestions>({ products: [], categories: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSuggestions({ products: [], categories: [] });
      setLoading(false);
      return;
    }

    // Aborted when the query moves on, so a slow reply for "ab" cannot land over "abc".
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setSuggestions(await searchApiClient.suggestions(debouncedQuery, controller.signal));
      } catch (error) {
        if (controller.signal.aborted) return;
        // A failed lookup shows no suggestions, never a stale list: the error body
        // was being stored as state, so the next render read `.products` off it.
        setSuggestions({ products: [], categories: [] });
        console.error("Failed to fetch suggestions:", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [debouncedQuery, debounceMs]);

  return { suggestions, loading };
}