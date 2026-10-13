import { apiRequest } from "@/lib/api-client";
import type {
  CreateProductTypeInput,
  UpdateProductTypeInput,
} from "@server/listing/admin.product-type.types";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * What the product-types console asks the browser to do. There is no plain `list`: the listing is
 * read by a server component through `adminProductTypesDAL` (ADR-0034).
 */
export const productTypeApiClient = {
  create(data: CreateProductTypeInput) {
    return apiRequest<ProductTypeRecord>("/api/admin/product-types", { method: "POST", body: data });
  },

  update(key: string, data: UpdateProductTypeInput) {
    return apiRequest<ProductTypeRecord>(`/api/admin/product-types/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: data,
    });
  },

  /** Retires rather than deletes — a type products name cannot be removed, and the reply says why. */
  retire(key: string) {
    return apiRequest<{ retired: boolean; usage: { categories: number; products: number } }>(
      `/api/admin/product-types/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
  },

  /** Only ever asked for with `includeRetired`, which a server component has no reason to do. */
  list(includeRetired = false) {
    return apiRequest<ProductTypeRecord[]>(`/api/admin/product-types?includeRetired=${includeRetired}`);
  },
};
