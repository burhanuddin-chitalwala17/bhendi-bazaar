import type { StatusTone } from "@/components/shared/badges/StatusBadge";
import { PRODUCT_SHELF_COPY } from "@/components/product/console/console-copy";

/** A product's one-word state on the list. Archived wins; then sold out, low, live. */
export function productStatus(p: { archivedAt: Date | string | null; stock: number; lowStockThreshold: number }): { label: string; tone: StatusTone } {
  if (p.archivedAt) return { label: PRODUCT_SHELF_COPY.archived, tone: "neutral" };
  if (p.stock === 0) return { label: PRODUCT_SHELF_COPY.soldOut, tone: "neutral" };
  if (p.stock <= p.lowStockThreshold) return { label: PRODUCT_SHELF_COPY.lowStock, tone: "warning" };
  return { label: PRODUCT_SHELF_COPY.live, tone: "success" };
}
