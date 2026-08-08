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
    return this.orgId ? `/api/org/${this.orgId}/products` : "/api/admin/products";
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
   * Delete product
   */
  async deleteProduct(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) throw await readApiError(response);
  }

  async updateProduct(id: string, data: ProductFormInput): Promise<ProductDetails | null> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw await readApiError(response);

    return response.json() as Promise<ProductDetails | null>;
  }
}
