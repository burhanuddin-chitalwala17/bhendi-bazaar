import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";
import { ADMIN_SHELL_COPY } from "./admin-copy";

/** An admin page while its reads run: a header and rows, where they will land. */
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label={ADMIN_SHELL_COPY.loading}>
      <SkeletonHeader />
      <SkeletonRows count={6} thumbnail={false} />
    </div>
  );
}
