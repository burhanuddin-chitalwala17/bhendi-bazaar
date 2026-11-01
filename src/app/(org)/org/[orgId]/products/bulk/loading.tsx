import { Skeleton } from "@/components/ui/skeleton";

/** The category list's skeleton while the ticks are read (ux.md Get the sheet, Loading). */
export default function Loading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-1/2" />
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
