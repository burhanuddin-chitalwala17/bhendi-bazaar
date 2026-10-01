import { apiRequest } from "@/lib/api-client";
import type { Product } from "@/domain/product";
import { productPageUrl, type ProductPageQuery } from "@/lib/product-paging";

/** The next page of any product listing, from the offset the grid has reached. */
export const productPagesApiClient = {
  next(query: ProductPageQuery, offset: number) {
    return apiRequest<{ products: Product[]; done: boolean }>(productPageUrl(query, offset));
  },
};
