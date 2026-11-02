import { Skeleton } from "@/components/ui/skeleton";

/** The fix page's rows as grey bars on first load (readiness-fix ux.md "Loading"). */
export default function ReadinessFixLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-3">
      <Skeleton className="h-8 w-2/3" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-card" />
      ))}
    </div>
  );
}
