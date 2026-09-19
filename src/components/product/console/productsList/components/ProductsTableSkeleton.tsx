import {
  FiltersSkeleton,
  PaginationSkeleton,
  StatsSkeleton,
  TableSkeleton,
} from "@/components/shared/states/LoadingSkeleton";

// ⭐ Loading skeleton
export function ProductsTableSkeleton() {
  return (
    <div className="space-y-4">
      <StatsSkeleton />
      <FiltersSkeleton />
      <TableSkeleton rows={10} />
      <PaginationSkeleton />
    </div>
  );
}
