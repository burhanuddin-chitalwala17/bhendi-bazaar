import { apiRequest } from "@/lib/api-client";
import type { ProductFormInput, ProductDetails } from "./types";

export class ProductsApiClient {
  /**
   * Which tree this client talks to. An org id means the org portal, whose handlers
   * scope every query to that org; without one it is the platform-admin route. Both
   * exist while the portals are being separated.
   */
  constructor(private readonly orgId?: string) {}

  private get baseUrl() {
    return this.orgId ? `/api/org/${this.orgId}/products` : "/api/admin/products";
  }

  createProduct(data: ProductFormInput): Promise<ProductDetails | null> {
    return apiRequest(this.baseUrl, { method: "POST", body: data });
  }

  /**
   * Delete a product outright. Refused, by name, if any record depends on it
   * (ADR-0029) — archiving is the separate act, and `setArchived` is its call.
   */
  deleteProduct(id: string): Promise<void> {
    return apiRequest(`${this.baseUrl}/${id}`, { method: "DELETE" });
  }

  /** Archive a product, or restore it. */
  setArchived(id: string, archived: boolean): Promise<void> {
    return apiRequest(`${this.baseUrl}/${id}/archive`, { method: "PATCH", body: { archived } });
  }

  updateProduct(id: string, data: ProductFormInput): Promise<ProductDetails | null> {
    return apiRequest(`${this.baseUrl}/${id}`, { method: "PATCH", body: data });
  }
}
