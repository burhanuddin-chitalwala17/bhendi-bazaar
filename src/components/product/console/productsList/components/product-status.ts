import type { StatusTone } from "@/components/shared/badges/StatusBadge";

/** A product's one-word state on the list. Archived wins; then sold out, low, live. */
export function productStatus(p: { archivedAt: Date | string | null; stock: number; lowStockThreshold: number }): { label: string; tone: StatusTone } {
  if (p.archivedAt) return { label: "Archived", tone: "neutral" };
  if (p.stock === 0) return { label: "Sold out", tone: "neutral" };
  if (p.stock <= p.lowStockThreshold) return { label: "Low stock", tone: "warning" };
  return { label: "Live", tone: "success" };
}
