// server/services/admin/productService.ts

import { adminProductsRepository } from "@server/catalog/admin.product.repository";
import { ProductFilters, ProductFormInput } from "@server/catalog/admin.product.types";
import { NotFoundError } from "@server/shared/domain-error";

export class ProductsService {  
  async getProducts(filters: ProductFilters) {
    return await adminProductsRepository.getProducts(filters);
  }
  
  async getStats() {
    return await adminProductsRepository.getStats();
  }

  async deleteProduct(id: string) {
    return await adminProductsRepository.deleteProduct(id);
  }

  async createProduct(data: ProductFormInput) {
    return await adminProductsRepository.createProduct(data);
  }

  async getProductById({ id }: { id: string }) {
    const product = await adminProductsRepository.getProductById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  async updateProduct(id: string, data: ProductFormInput) {
    const product = await adminProductsRepository.updateProduct(id, data);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }
}

export const productsService = new ProductsService();