// DATA ACCESS LAYER FOR PRODUCT TYPES

import { cache } from "react";

import { FACT_DECLARATIONS } from "@server/listing/listing-facts";
import { listingValueRepository } from "@server/listing/listing-value.repository";
import { productTypeRepository } from "@server/listing/product-type.repository";
import { resolveProductType } from "@server/listing/product-type";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * What the product-types console reads, on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 *
 * `cache` is React's per-request memo, not a caching layer: a page that reads the list and then
 * a usage count reads each once. Types are tens of rows and change rarely, which is why two
 * indexed reads do not earn more than that (product-types D5).
 */
class ProductTypesDAL {
  getProductTypes = cache(async (includeRetired = true): Promise<ProductTypeRecord[]> => {
    return productTypeRepository.list(includeRetired);
  });

  getProductType = cache(async (key: string): Promise<ProductTypeRecord | null> => {
    return productTypeRepository.byKey(key);
  });

  /**
   * The answers a product form needs for the category it is rendering with, so the first load
   * shows filled dropdowns rather than empty ones that fill in afterwards. Changing the category
   * fetches the rest through the route — only an interaction costs a round trip (ADR-0034).
   *
   * Only the lists that one type asks about: there are a thousand values and this needs a
   * handful (product-types D5).
   */
  getValuesForCategory = cache(
    async (
      categoryId: string | null,
      categories: readonly { id: string; parentId?: string | null; productType?: unknown }[],
      orgId: string,
    ) => {
      const key = resolveProductType(categoryId, categories);
      const type = await productTypeRepository.byKey(key);
      if (!type) return {};
      const lists = type.facts
        .map((fact) => FACT_DECLARATIONS[fact]?.list)
        .filter((list): list is string => !!list);
      return listingValueRepository.byLists(lists, orgId);
    },
  );

  /** How many categories and products name each type — what the list shows beside it. */
  getUsage = cache(async (keys: readonly string[]) => {
    const entries = await Promise.all(
      keys.map(async (key) => [key, await productTypeRepository.usage(key)] as const),
    );
    return Object.fromEntries(entries) as Record<string, { categories: number; products: number }>;
  });
}

export const adminProductTypesDAL = new ProductTypesDAL();
