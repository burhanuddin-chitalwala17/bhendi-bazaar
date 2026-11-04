import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";
import { ORDER_PAGE_COPY } from "./order-page-copy";

// No page below calls notFound(), so streaming this first cannot turn a 404 into a 200
// (tests/unit/honest-status.test.ts).
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={ORDER_PAGE_COPY.loading}>
      <SkeletonHeader />
      <SkeletonRows count={2} />
    </div>
  );
}
