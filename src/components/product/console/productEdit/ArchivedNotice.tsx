"use client";

import { Button } from "@/components/ui/button";
import { useProducts } from "../useProducts";

/** The team opened an archived product: it is restored before it is edited (product-form D12, ADR-0029). */
export function ArchivedNotice({ productId }: { productId: string }) {
  const { restoreForShop, isLoading } = useProducts();
  return (
    <div role="status" className="flex flex-col gap-3 rounded-card border border-warning/40 bg-warning/10 p-4 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>This product is archived. Restore it to edit.</span>
      {/* Never disabled: a second tap while restoring is ignored (R13). */}
      <Button type="button" variant="outline" aria-busy={isLoading} onClick={() => !isLoading && void restoreForShop(productId)}>
        Restore
      </Button>
    </div>
  );
}
