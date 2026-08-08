// server/services/admin/productService.ts

import { adminProductsRepository } from "@server/catalog/admin.product.repository";
import { ProductFilters, ProductFormInput } from "@server/catalog/admin.product.types";
import { NotFoundError } from "@server/shared/domain-error";
import { rupeesToPaise } from "@server/shared/money";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { DomainError } from "@server/shared/domain-error";

/**
 * Pure, exported for tests: every submitted stock row must name a location the
 * product's own org owns — otherwise a member of one org could park stock at (and
 * attribute parcels to) another org's address by editing the payload.
 */
export function assertLocationsBelongToOrg(
  rows: Array<{ orgAddressId: string }>,
  orgLocationIds: string[]
): void {
  const owned = new Set(orgLocationIds);
  if (rows.some((row) => !owned.has(row.orgAddressId))) {
    throw new DomainError("One of the chosen pickup locations does not belong to this organisation", {
      field: "stockLocations",
    });
  }
}

export class ProductsService {  
  async getProducts(filters: ProductFilters) {
    return await adminProductsRepository.getProducts(filters);
  }
  
  async getStats(orgId: string | null) {
    return await adminProductsRepository.getStats(orgId);
  }

  async deleteProduct(id: string) {
    return await adminProductsRepository.deleteProduct(id);
  }

  async createProduct(data: ProductFormInput) {
    await this.checkLocations(data);
    return await adminProductsRepository.createProduct(this.moneyToPaise(data));
  }

  async getProductById({ id }: { id: string }) {
    const product = await adminProductsRepository.getProductById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  async updateProduct(id: string, data: ProductFormInput) {
    await this.checkLocations(data);
    const product = await adminProductsRepository.updateProduct(id, this.moneyToPaise(data));
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  private async checkLocations(data: ProductFormInput): Promise<void> {
    const locations = await orgAddressRepository.listByOrg(data.orgId);
    assertLocationsBelongToOrg(data.stockLocations, locations.map((l) => l.id));
  }

  /**
   * The rupees→paise seam (Invariant 3). The form collects rupees because humans type
   * rupees; everything past this line is integer paise. Conversion happens here rather
   * than in a Zod transform because the same schema validates on both client and
   * server (ADR-0013) — a transform would run twice and multiply by 100 twice.
   */
  private moneyToPaise(data: ProductFormInput): ProductFormInput {
    return {
      ...data,
      price: rupeesToPaise(data.price),
      salePrice: data.salePrice === undefined ? undefined : rupeesToPaise(data.salePrice),
    };
  }
}

export const productsService = new ProductsService();