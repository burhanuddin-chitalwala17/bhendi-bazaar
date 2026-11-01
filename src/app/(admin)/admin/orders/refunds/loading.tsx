import { Skeleton } from "@/components/ui/skeleton";

/** Rows in their final places (ux.md "admin refunds", Loading). */
export default function RefundsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-32" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-24 rounded-card" />
      ))}
    </div>
  );
}
