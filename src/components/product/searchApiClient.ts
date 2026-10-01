import { apiRequest } from "@/lib/api-client";
import type { ProductSuggestion } from "@/domain/product";
import type { Category } from "@/domain/category";

export interface SearchSuggestions {
  products: ProductSuggestion[];
  categories: Category[];
}

export const searchApiClient = {
  suggestions(query: string, signal?: AbortSignal): Promise<SearchSuggestions> {
    return apiRequest(`/api/search/suggestions?q=${encodeURIComponent(query)}`, { signal });
  },
};
