import { Skeleton } from "@/components/ui/skeleton";

/** ux.md "admin fee setting" Loading: the field and the table in their final places. */
export default function FulfilmentSettingsLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 rounded-card" />
      <Skeleton className="h-40 rounded-card" />
    </div>
  );
}
