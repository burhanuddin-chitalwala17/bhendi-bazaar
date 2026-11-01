import { Skeleton } from "@/components/ui/skeleton";

/** Rows in their final places (ux.md "Shop orders", Loading). */
export default function ShopOrdersLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" />
        ))}
      </div>
    </div>
  );
}
