/**
 * What the product-types console asks the browser to do.
 *
 * There is no `list` here: the listing is read by a server component through
 * `adminProductTypesDAL` ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)).
 * What remains is what a person's click has to perform.
 *
 * Every failure comes back through `readApiError`, never by reaching into the body by hand —
 * a key mismatch there typechecks and fails silently, which has happened three times in this
 * codebase ([ADR-0013](../../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
 */

import { readApiError } from "@/lib/api-error";
import type {
  CreateProductTypeInput,
  UpdateProductTypeInput,
} from "@server/catalog/admin.product-type.types";
import type { ProductTypeRecord } from "@server/catalog/product-type.types";

class AdminProductTypeApiClient {
  async createProductType(data: CreateProductTypeInput): Promise<ProductTypeRecord> {
    const response = await fetch(`/api/admin/product-types`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }

  async updateProductType(key: string, data: UpdateProductTypeInput): Promise<ProductTypeRecord> {
    const response = await fetch(`/api/admin/product-types/${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }

  /**
   * Retires rather than deletes — a type products name cannot be removed, and the server says so
   * with the counts rather than refusing silently.
   */
  async retireProductType(
    key: string,
  ): Promise<{ retired: boolean; usage: { categories: number; products: number } }> {
    const response = await fetch(`/api/admin/product-types/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }

  /** Only ever asked for with `includeRetired`, which a server component has no reason to do. */
  async listProductTypes(includeRetired = false): Promise<ProductTypeRecord[]> {
    const response = await fetch(`/api/admin/product-types?includeRetired=${includeRetired}`);
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }
}

export const adminProductTypeApiClient = new AdminProductTypeApiClient();
