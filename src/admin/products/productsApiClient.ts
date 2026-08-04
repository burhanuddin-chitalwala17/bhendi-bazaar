/**
 * Admin Product Service (Client-side)
 * Handles API calls for product management
 */

import { ProductFormInput, ProductDetails } from "./types";

export class ProductsApiClient {
  private baseUrl = "/api/admin/products";
  /**
   * Create product
   */
  async createProduct(data: ProductFormInput): Promise<ProductDetails | null> {
    const response = await fetch(this.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create product");
    }

    return response.json() as Promise<ProductDetails | null>;
  }
  /**
   * Delete product
   */
  async deleteProduct(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete product");
    }
  }

  async updateProduct(id: string, data: ProductFormInput): Promise<ProductDetails | null> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update product");
    }

    return response.json() as Promise<ProductDetails | null>;
  }
}
