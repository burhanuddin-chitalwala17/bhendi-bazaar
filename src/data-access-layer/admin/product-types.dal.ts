// DATA ACCESS LAYER FOR PRODUCT TYPES

import { cache } from "react";

import { productTypeRepository } from "@server/catalog/product-type.repository";
import type { ProductTypeRecord } from "@server/catalog/product-type.types";

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

  /** How many categories and products name each type — what the list shows beside it. */
  getUsage = cache(async (keys: readonly string[]) => {
    const entries = await Promise.all(
      keys.map(async (key) => [key, await productTypeRepository.usage(key)] as const),
    );
    return Object.fromEntries(entries) as Record<string, { categories: number; products: number }>;
  });
}

export const adminProductTypesDAL = new ProductTypesDAL();
