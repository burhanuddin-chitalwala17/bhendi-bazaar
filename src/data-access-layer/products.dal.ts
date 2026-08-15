// src/data-access-layer/products.dal.ts

// fetch product direct from the database using repository pattern

import { productsRepository } from "@server/catalog/product.repository";
import { productService } from "@server/catalog/product.service";
import { Product, ProductFilter } from "@/domain/product";

import { NotFoundError } from "@server/shared/domain-error";
import {
  loadPriceContext,
  resolveProductPrice,
  type PriceContext,
} from "@server/promotions/price-context";
export { NotFoundError };

const mapProduct = (product: any, context: PriceContext): Product => {
  // The customer sees one availability figure: the total across active locations
  // (stock-locations R4/R11). The indicative origin for serviceability is the
  // largest holding's pincode — allocation decides the real origin at checkout.
  const stockRows: Array<{ quantity: number; orgAddress: { address: { pincode: string } } }> =
    product.stockLocations ?? [];
  const totalStock = stockRows.reduce((sum: number, row) => sum + row.quantity, 0);
  const mainRow = [...stockRows].sort((a, b) => b.quantity - a.quantity)[0];
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    price: product.price,
    // Resolved through the one function checkout also prices with (ADR-0018), so the
    // storefront cannot advertise a price the server would refuse. Markdowns are
    // offers now, so this covers them too — and because both sides start from the
    // list price, they compete rather than compound (ADR-0019).
    salePrice: offerPrice(product, context),
    currency: product.currency,
    categorySlug: product.category.slug,
    tags: product.tags,
    flags: product.flags,
    rating: product.rating,
    reviewsCount: product.reviewsCount,
    media: product.media ?? [],
    thumbnail: product.thumbnail,
    weight: product.weight ?? 0,
    stock: totalStock,
    lowStockThreshold: product.lowStockThreshold,
    options: {
      sizes: product.sizes,
      colors: product.colors,
    },
    shippingFromPincode: mainRow?.orgAddress.address.pincode || "",
    org: {
      id: product.org.id,
      name: product.org.name,
      code: product.org.code,
    },
  };
};

/** The reduced price a buyer sees, or undefined when nothing applies. */
const offerPrice = (product: any, context: PriceContext): number | undefined => {
  const { pricePaise, offerPricePaise } = resolveProductPrice(
    { id: product.id, price: product.price, orgId: product.orgId, categoryId: product.categoryId },
    context
  );
  return offerPricePaise < pricePaise ? offerPricePaise : undefined;
};

export const productsDAL = {

  getProducts: async (filter: ProductFilter): Promise<Product[]> => {
    try {
      // Through the service, which expands a category slug to its subtree.
      const [products, context] = await Promise.all([
        productService.getProducts(filter),
        loadPriceContext(),
      ]);
      return products.filter(p => p !== null).map((product) => mapProduct(product, context));
    } catch (error) {
      throw new Error("Failed to fetch products", { cause: error });
    }
  },

  getProductById: async (id: string): Promise<Product> => {
    try {
      const [product, context] = await Promise.all([
        productsRepository.getProductById(id),
        loadPriceContext(),
      ]);
      if (!product) {
        throw new NotFoundError(`No product with id ${JSON.stringify(id)}`);
      }
      return mapProduct(product, context);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error("Failed to fetch product", { cause: error });
    }
  },

  getProductBySlug: async (slug: string): Promise<Product> => {
    try {
      const [product, context] = await Promise.all([
        productsRepository.getProductBySlug(slug),
        loadPriceContext(),
      ]);
      // console.log("Product: ", JSON.stringify(product, null, 2));
      if (!product) {
        throw new NotFoundError(`No product with slug ${JSON.stringify(slug)}`);
      }
      return mapProduct(product, context);
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new Error("Failed to fetch product", { cause: error });
    }
  },

  getSimilarProducts: async (slug: string, count: number): Promise<Product[]> => {
    const [products, context] = await Promise.all([
      productsRepository.getSimilarProducts(slug, count),
      loadPriceContext(),
    ]);
    return products.filter(p => p !== null).map((product) => mapProduct(product, context));
  },

  getHeroProducts: async (limit: number): Promise<Product[]> => {
    const [products, context] = await Promise.all([
      productsRepository.getHeroProducts(limit),
      loadPriceContext(),
    ]);
    return products.filter(p => p !== null).map((product) => mapProduct(product, context));
  },

  getOfferProducts: async (limit: number): Promise<Product[]> => {
    const [products, context] = await Promise.all([
      productsRepository.getOfferProducts(limit),
      loadPriceContext(),
    ]);
    return products.filter(p => p !== null).map((product) => mapProduct(product, context));
  },
};