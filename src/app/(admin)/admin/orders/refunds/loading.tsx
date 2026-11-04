import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";

/** Rows in their final places (ux.md admin pickups and refunds, Loading). */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <SkeletonHeader />
      <SkeletonRows count={4} thumbnail={false} />
    </div>
  );
}
