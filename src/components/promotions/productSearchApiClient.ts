import { apiRequest } from "@/lib/api-client";

export interface ProductSearchResult {
  products: Array<{ id: string; name: string }>;
  total: number;
}

/** The pickers' product search. `searchPath` is scoped by the route that renders the picker. */
export const productSearchApiClient = {
  search: (searchPath: string, term: string, signal?: AbortSignal) =>
    apiRequest<ProductSearchResult>(
      term ? `${searchPath}?q=${encodeURIComponent(term)}` : searchPath,
      { signal },
    ),
};
