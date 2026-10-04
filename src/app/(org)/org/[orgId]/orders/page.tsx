import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { OrgOrdersTable } from "@/components/org/org-orders-table";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
import { SectionHeader } from "@/components/shared/SectionHeader";

export const metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

export default async function OrgOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ page?: string; limit?: string }>;
}) {
  const { orgId } = await params;
  const { page, limit } = await searchParams;
  const { orders, pagination } = await orgOrdersDAL.getOrders(
    orgId,
    resolvePageNumber(page),
    resolvePageSize(limit),
  );

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" title="Orders" description="Orders with a parcel that ships from your organisation" />
      <OrgOrdersTable orders={orders} pagination={pagination} orgId={orgId} />
    </div>
  );
}
