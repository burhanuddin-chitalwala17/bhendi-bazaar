import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";
import { CHECKOUT_COPY } from "@/components/checkout/checkout-copy";

// No page below calls notFound(), so streaming this first cannot turn a 404 into a 200
// (tests/unit/honest-status.test.ts).
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label={CHECKOUT_COPY.loading}>
      <SkeletonHeader description={false} />
      <SkeletonRows count={3} thumbnail={false} />
    </div>
  );
}
