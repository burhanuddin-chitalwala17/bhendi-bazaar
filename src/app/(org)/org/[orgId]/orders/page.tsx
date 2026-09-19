import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { OrgOrdersTable } from "@/org/org-orders-table";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";

export const metadata = { title: "Orders", robots: { index: false, follow: false } };

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
    resolvePageSize(limit)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Orders</h1>
        <p className="text-muted-foreground">
          Orders with a parcel that ships from your organisation
        </p>
      </div>
      <OrgOrdersTable orders={orders} pagination={pagination} orgId={orgId} />
    </div>
  );
}
