import { Skeleton } from "@/components/ui/skeleton";

/** The parcel card in its final place (ux.md "Shop parcel", Loading). */
export default function ShopParcelLoading() {
  return (
    <div className="max-w-4xl space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-48 rounded-card" />
    </div>
  );
}
