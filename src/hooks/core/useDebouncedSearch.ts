// hooks/core/useDebouncedSearch.ts

import { useEffect, type DependencyList } from "react";
import { useAsyncData } from "./useAsyncData";
import { useDebounce } from "./useDebounce";

interface UseDebouncedSearchOptions {
  delay?: number;
  enabled?: boolean;
  /** An empty box means "show what you started with" rather than "search for everything". */
  skipEmpty?: boolean;
  /** Anything besides the term that should re-run the search, such as its endpoint. */
  dependencies?: DependencyList;
}

/**
 * A search that runs as someone types. Debounced, so a word is one request; built on
 * `useAsyncData`, so a slow reply for an older term is aborted rather than landing over
 * the current one. Clearing the box is not debounced — it answers at once.
 */
export function useDebouncedSearch<T>(
  term: string,
  search: (term: string, signal: AbortSignal) => Promise<T>,
  { delay = 250, enabled = true, skipEmpty = false, dependencies = [] }: UseDebouncedSearchOptions = {},
) {
  const debounced = useDebounce(term, delay);
  const query = term === "" ? "" : debounced;
  const active = enabled && !(skipEmpty && query === "");

  const { data, loading, error, reset } = useAsyncData((signal) => search(query, signal), {
    enabled: active,
    refetchDependencies: [query, ...dependencies],
  });

  // Results for a term that is no longer asked are stale, so they go rather than linger.
  useEffect(() => {
    if (!active) reset();
  }, [active, reset]);

  return { query, data, isSearching: loading, error };
}
