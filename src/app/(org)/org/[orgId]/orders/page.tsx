import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { OrgOrdersTable } from "@/components/org/org-orders-table";
import { OrgOrdersFilters } from "@/components/org/org-orders-filters";
import { resolvePageNumber, resolvePageSize } from "@server/shared/pagination";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ORDER_STATUS } from "@server/checkout/order.types";

export const metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

const ALLOWED_STATUSES: Set<string> = new Set(Object.values(ORDER_STATUS));

export default async function OrgOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { orgId } = await params;
  const raw = await searchParams;
  const page = typeof raw.page === "string" ? raw.page : undefined;
  const limit = typeof raw.limit === "string" ? raw.limit : undefined;
  const search = typeof raw.search === "string" ? raw.search.trim() : undefined;
  const rawStatus = typeof raw.status === "string" ? raw.status : undefined;
  const status = rawStatus && ALLOWED_STATUSES.has(rawStatus) ? rawStatus : undefined;

  const { orders, pagination } = await orgOrdersDAL.getOrders(
    orgId,
    resolvePageNumber(page),
    resolvePageSize(limit),
    { search: search || undefined, status: status || undefined },
  );

  return (
    <div className="space-y-6">
      <SectionHeader as="h1" title="Orders" description="Orders with a parcel that ships from your organisation" />
      <OrgOrdersFilters />
      <OrgOrdersTable orders={orders} pagination={pagination} orgId={orgId} />
    </div>
  );
}
