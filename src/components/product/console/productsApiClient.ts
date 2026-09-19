/**
 * Admin Product Service (Client-side)
 * Handles API calls for product management
 */

import { ProductFormInput, ProductDetails } from "./types";
import { readApiError } from "@/lib/api-error";

export class ProductsApiClient {
  /**
   * Which tree this client talks to. An org id means the org portal, whose handlers
   * scope every query to that org; without one it is the platform-admin route. Both
   * exist while the portals are being separated.
   */
  constructor(private readonly orgId?: string) {}

  private get baseUrl() {
    return this.orgId
      ? `/api/org/${this.orgId}/products`
      : "/api/admin/products";
  }
  /**
   * Create product
   */
  async createProduct(data: ProductFormInput): Promise<ProductDetails | null> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw await readApiError(response);

    return response.json() as Promise<ProductDetails | null>;
  }
  /**
   * Delete product — or archive it, if any record depends on it (ADR-0029).
   *
   * The server decides which, and says so in the response, so the caller can report
   * what happened without a second request.
   */
  async deleteProduct(
    id: string,
  ): Promise<{ outcome: "deleted" | "archived" }> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw await readApiError(response);

    return response.json() as Promise<{ outcome: "deleted" | "archived" }>;
  }

  /** Take a product off sale, or put it back. */
  async setArchived(id: string, archived: boolean): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });

    if (!response.ok) throw await readApiError(response);
  }

  async updateProduct(
    id: string,
    data: ProductFormInput,
  ): Promise<ProductDetails | null> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw await readApiError(response);

    return response.json() as Promise<ProductDetails | null>;
  }
}
