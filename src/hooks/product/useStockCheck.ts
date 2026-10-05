// hooks/product/useStockCheck.ts

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { stockApiClient, type StockCheckLine } from "@/components/product/stockApiClient";

interface StockCheckResult {
  available: boolean;
  issues: Array<{ productId: string; message: string }>;
}

export function useStockCheck() {
  const [checking, setChecking] = useState(false);

  const checkStock = useCallback(
    async (items: StockCheckLine[]): Promise<StockCheckResult> => {
      if (items.length === 0) {
        return { available: true, issues: [] };
      }

      try {
        setChecking(true);

        const data = await stockApiClient.check(items);

        if (!data.available) {
          const requested = new Map(items.map((item) => [item.productId, item.quantity]));
          const issues = data.items
            .filter((item) => !item.available)
            .map((item) => ({
              productId: item.productId,
              message: `Only ${item.stock} available for ${item.name} (you requested ${requested.get(item.productId)})`,
            }));

          return { available: false, issues };
        }

        return { available: true, issues: [] };
      } catch (error) {
        console.error("Stock check failed:", error);
        toast.error("Failed to verify stock availability");
        return {
          available: false,
          issues: [
            { productId: "", message: "Failed to verify stock availability" },
          ],
        };
      } finally {
        setChecking(false);
      }
    },
    []
  );

  return { checkStock, checking };
}