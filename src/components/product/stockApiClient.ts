import { apiRequest } from "@/lib/api-client";

export interface StockCheckLine {
  productId: string;
  quantity: number;
}

/** One line of the answer: the product's summed stock across active locations (stock-locations R4). */
export interface StockCheckRow {
  productId: string;
  name: string;
  available: boolean;
  stock: number;
}

export interface StockCheckResponse {
  available: boolean;
  items: StockCheckRow[];
}

export const stockApiClient = {
  check(items: StockCheckLine[], signal?: AbortSignal): Promise<StockCheckResponse> {
    return apiRequest("/api/products/check-stock", { method: "POST", body: { items }, signal });
  },
};
