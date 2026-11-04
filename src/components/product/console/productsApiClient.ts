import { apiRequest, TRANSFER_TIMEOUT_MS } from "@/lib/api-client";
import type { ProductFormInput, ProductDetails } from "./types";
import type { BulkActionResultDTO } from "@server/catalog/product-bulk.types";
import type { BulkProductActionInput, TeamBulkProductActionInput } from "@/lib/validation/schemas/product-bulk.schema";

export class ProductsApiClient {
  /**
   * Which tree this client talks to. An org id means the org portal, whose handlers
   * scope every query to that org; `team` is the Bhendi Bazaar team acting for that
   * shop through the admin routes (product-form D12).
   */
  constructor(
    private readonly orgId?: string,
    private readonly team = false,
  ) {}

  private get baseUrl() {
    return this.orgId && !this.team ? `/api/org/${this.orgId}/products` : "/api/admin/products";
  }

  createProduct(data: ProductFormInput): Promise<ProductDetails | null> {
    // The team adds a product under the shop's path, so the shop is never the body's to name.
    const url = this.team ? `/api/admin/orgs/${this.orgId}/products` : this.baseUrl;
    return apiRequest(url, { method: "POST", body: data });
  }

  /** The team restores an archived shop product so it can be edited (product-form D12). */
  restoreForShop(id: string): Promise<void> {
    return apiRequest(`${this.baseUrl}/${id}/restore`, { method: "POST" });
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

  /**
   * A bulk action on selected products (design-system Q29). The shop's portal scopes it to its own
   * products; the team's carries the reason the shop will read.
   */
  bulkEdit(input: BulkProductActionInput): Promise<BulkActionResultDTO> {
    return apiRequest(`/api/org/${this.orgId}/products/bulk-edit`, { method: "POST", body: input, timeoutMs: TRANSFER_TIMEOUT_MS });
  }

  teamBulkEdit(input: TeamBulkProductActionInput): Promise<BulkActionResultDTO> {
    return apiRequest("/api/admin/products/bulk-edit", { method: "POST", body: input, timeoutMs: TRANSFER_TIMEOUT_MS });
  }
}
