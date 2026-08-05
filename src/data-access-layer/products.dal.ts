// src/data-access-layer/products.dal.ts

// fetch product direct from the database using repository pattern

import { productsRepository } from "@server/catalog/product.repository";
import { Product, ProductFilter } from "@/domain/product";

import { NotFoundError } from "@server/shared/domain-error";
export { NotFoundError };

const mapProduct = (product: any): Product => {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    salePrice: product.salePrice ?? undefined,
    currency: product.currency,
    categorySlug: product.category.slug,
    tags: product.tags,
    flags: product.flags,
    rating: product.rating,
    reviewsCount: product.reviewsCount,
    images: product.images,
    thumbnail: product.thumbnail,
    weight: product.weight ?? 0,
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    options: {
      sizes: product.sizes,
      colors: product.colors,
    },
    shippingFromPincode: product.shippingFromPincode || product.seller.defaultPincode || "",
    seller: {
      id: product.seller.id,
      name: product.seller.name,
      code: product.seller.code,
      defaultPincode: product.seller.defaultPincode,
      defaultCity: product.seller.defaultCity,
      defaultState: product.seller.defaultState,
      defaultAddress: product.seller.defaultAddress ?? "",
    },
  };
};

export const productsDAL = {

  getProducts: async (filter: ProductFilter): Promise<Product[]> => {
    try {
      const products = await productsRepository.getProducts(filter);
      return products.filter(p => p !== null).map((product) => mapProduct(product));
    } catch (error) {
      throw new Error("Failed to fetch products", { cause: error });
    }
  },

  getProductById: async (id: string): Promise<Product> => {
    try {
      const product = await productsRepository.getProductById(id);
      if (!product) {
        throw new NotFoundError(`No product with id ${JSON.stringify(id)}`);
      }
      return mapProduct(product);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error("Failed to fetch product", { cause: error });
    }
  },

  getProductBySlug: async (slug: string): Promise<Product> => {
    try {
      const product = await productsRepository.getProductBySlug(slug);
      // console.log("Product: ", JSON.stringify(product, null, 2));
      if (!product) {
        throw new NotFoundError(`No product with slug ${JSON.stringify(slug)}`);
      }
      return mapProduct(product);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error("Failed to fetch product", { cause: error });
    }
  },

  getSimilarProducts: async (slug: string, count: number): Promise<Product[]> => {
    const products = await productsRepository.getSimilarProducts(slug, count);
    return products.filter(p => p !== null).map((product) => mapProduct(product));
  },

  getHeroProducts: async (limit: number): Promise<Product[]> => {
    const products = await productsRepository.getHeroProducts(limit);
    return products.filter(p => p !== null).map((product) => mapProduct(product));
  },

  getOfferProducts: async (limit: number): Promise<Product[]> => {
    const products = await productsRepository.getOfferProducts(limit);
    return products.filter(p => p !== null).map((product) => mapProduct(product));
  },
};