import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { OrgOrdersTable } from "@/components/org/org-orders-table";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";

interface Props {
  orgId: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function AdminOrgOrders({ orgId, searchParams }: Props) {
  const params = await searchParams;
  const page = Array.isArray(params.page) ? params.page[0] : params.page;
  const limit = Array.isArray(params.limit) ? params.limit[0] : params.limit;

  const { orders, pagination } = await orgOrdersDAL.getOrders(
    orgId,
    resolvePageNumber(page),
    resolvePageSize(limit),
  );

  return <OrgOrdersTable orders={orders} pagination={pagination} orgId={orgId} />;
}
