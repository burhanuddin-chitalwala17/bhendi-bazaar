import Link from "next/link";
import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Orders", robots: { index: false, follow: false } };

const badge = (value: string) =>
  value === "paid" || value === "delivered"
    ? "bg-emerald-50 text-emerald-700"
    : value === "failed" || value === "cancelled"
      ? "bg-red-50 text-red-700"
      : "bg-amber-50 text-amber-800";

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

      {orders.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-muted-foreground">
          No orders yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Your parcel value</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Ships to</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/org/${orgId}/orders/${order.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      {order.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {new Date(order.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">{order.itemCount}</td>
                  <td className="px-4 py-3">{formatCurrency(order.parcelValue)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${badge(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {order.address.city}, {order.address.pincode}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`/org/${orgId}/orders?page=${n}`}
              className={`rounded px-3 py-1 text-sm ${n === pagination.page ? "bg-emerald-600 text-white" : "border hover:bg-gray-50"}`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
