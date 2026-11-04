import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";
import { ADMIN_SHELL_COPY } from "../../admin-copy";

/** Rows in their final places (ux.md admin pickups and refunds, Loading). */
export default function Loading() {
  return (
    <div className="space-y-6" role="status" aria-label={ADMIN_SHELL_COPY.loading}>
      <SkeletonHeader />
      <SkeletonRows count={4} thumbnail={false} />
    </div>
  );
}
