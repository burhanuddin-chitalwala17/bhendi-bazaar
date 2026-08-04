// server/services/admin/productService.ts

import { productsRepository } from "@server/catalog/admin.product.repository";
import { ProductFilters, ProductFormInput } from "@server/catalog/admin.product.types";

export class ProductsService {  
  async getProducts(filters: ProductFilters) {
    return await productsRepository.getProducts(filters);
  }
  
  async getStats() {
    return await productsRepository.getStats();
  }

  async deleteProduct(id: string) {
    return await productsRepository.deleteProduct(id);
  }

  async createProduct(data: ProductFormInput) {
    return await productsRepository.createProduct(data);
  }

  async getProductById({ id }: { id: string }) {
    const product = await productsRepository.getProductById(id);
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }

  async updateProduct(id: string, data: ProductFormInput) {
    const product = await productsRepository.updateProduct(id, data);
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }
}

export const productsService = new ProductsService();