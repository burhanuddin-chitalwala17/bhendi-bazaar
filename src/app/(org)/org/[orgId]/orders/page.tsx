import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { OrgOrdersTable } from "@/org/org-orders-table";

export const metadata = { title: "Orders", robots: { index: false, follow: false } };

export default async function OrgOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { orgId } = await params;
  const { page } = await searchParams;
  const { orders, pagination } = await orgOrdersDAL.getOrders(orgId, Number(page) || 1);

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
