import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PRODUCT_GRID_CLASSES } from "@/components/shared/product-grid";

interface LoadingSkeletonProps {
  count?: number;
  className?: string;
  variant?: "text" | "card" | "image" | "button";
}

export function LoadingSkeleton({
  count = 1,
  className,
  variant = "text",
}: LoadingSkeletonProps) {
  const variantClasses = {
    text: "h-4 w-full rounded",
    card: "h-48 w-full rounded-lg",
    image: "aspect-[3/4] w-full rounded-lg",
    button: "h-9 w-24 rounded-md",
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "animate-pulse bg-muted",
            variantClasses[variant],
            className
          )}
        />
      ))}
    </>
  );
}

// export function ProductCardSkeleton() {
//   return (
//     <div className="space-y-3">
//       <LoadingSkeleton variant="image" />
//       <LoadingSkeleton variant="text" className="w-3/4" />
//       <LoadingSkeleton variant="text" className="w-1/2" />
//       <LoadingSkeleton variant="button" />
//     </div>
//   );
// }

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="space-y-3">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex gap-4">
        <div className="flex-1 h-10 bg-muted animate-pulse rounded-lg" />
        <div className="w-40 h-10 bg-muted animate-pulse rounded-lg" />
      </div>
    </div>
  );
}

export function PaginationSkeleton() {
  return (
    <div className="flex justify-between items-center">
      <div className="h-8 w-32 bg-muted animate-pulse rounded" />
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="w-10 h-10 bg-muted animate-pulse rounded"
          />
        ))}
      </div>
    </div>
  );
}

export function StatsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex gap-4">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="flex-1 h-24 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Mirrors ProductCard's dense phone tile — a skeleton on a different grid is a layout
// jump at the exact moment the shopper starts reading.
export function ProductCardSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden rounded-lg py-0 sm:rounded-xl">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        <Skeleton className="h-full w-full" />
      </div>

      <div className="space-y-1 p-2 sm:space-y-2 sm:p-4">
        {/* Category — hidden below sm on the real card */}
        <Skeleton className="hidden h-3 w-20 sm:block" />

        {/* Title - 2 lines */}
        <div className="space-y-1">
          <Skeleton className="h-3 w-full sm:h-4" />
          <Skeleton className="h-3 w-3/4 sm:h-4" />
        </div>

        {/* Price */}
        <Skeleton className="h-4 w-16 sm:h-5 sm:w-24" />
      </div>
    </Card>
  );
}

// Grid skeleton for multiple cards
export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className={PRODUCT_GRID_CLASSES}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}


export function ProductPageSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Gallery and Details Section */}
      <div className="grid gap-4 sm:gap-8 lg:grid-cols-2">
        {/* Gallery Skeleton */}
        <div className="space-y-2 sm:space-y-4">
          {/* Main Image */}
          <Skeleton className="-mx-3 aspect-[3/4] w-auto sm:mx-0 sm:w-full sm:rounded-lg" />

          {/* Thumbnail Strip */}
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-20 rounded-md" />
            ))}
          </div>
        </div>

        {/* Details Skeleton */}
        <div className="space-y-6">
          {/* Category & Title */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-48" />
          </div>

          {/* Price */}
          <div className="space-y-2">
            <Skeleton className="h-9 w-32" />
          </div>

          {/* Stock */}
          <Skeleton className="h-5 w-40" />

          {/* Description */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          {/* Sizes */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <div className="flex gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-12 rounded-full" />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1" />
            <Skeleton className="h-11 flex-1" />
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>

      {/* Similar Products */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <ProductGridSkeleton count={3} />
      </div>
    </div>
  );
}