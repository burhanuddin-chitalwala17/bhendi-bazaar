import { PageLoading } from "@/components/shared/PageLoading";

// No page below calls notFound(), so streaming this first cannot turn a 404 into a 200
// (tests/unit/honest-status.test.ts).
export default function Loading() {
  return <PageLoading label="Loading your order" />;
}
