import Link from "next/link";
import { notFound } from "next/navigation";
import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { formatCurrency } from "@/lib/format";

export const metadata = { robots: { index: false, follow: false } };

export default async function OrgOrderDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; orderId: string }>;
}) {
  const { orgId, orderId } = await params;

  // Not-found rather than forbidden when the order has no parcel from this org:
  // whether the order exists for someone else is not this caller's business.
  const order = await orgOrdersDAL.getOrder(orderId, orgId);
  if (!order) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{order.code}</h1>
          <p className="text-muted-foreground">
            Placed {new Date(order.createdAt).toLocaleString("en-IN")} · payment{" "}
            {order.paymentStatus}
          </p>
        </div>
        <Link href={`/org/${orgId}/orders`} className="text-sm text-emerald-700 hover:underline">
          ← All orders
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Deliver to
        </h2>
        <p className="font-medium">{order.address.fullName}</p>
        <p className="text-sm text-muted-foreground">
          {order.address.addressLine1}
          {order.address.addressLine2 ? `, ${order.address.addressLine2}` : ""}
          <br />
          {order.address.city}, {order.address.state} — {order.address.pincode}
          <br />
          {order.address.mobile}
        </p>
      </div>

      {order.shipments.map((shipment, index) => (
        <div key={shipment.id} className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">
              {order.shipments.length > 1 ? `Parcel ${index + 1} — ` : ""}
              {shipment.code}
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{shipment.status}</span>
          </div>

          <ul className="divide-y">
            {shipment.items.map((item) => (
              <li key={item.productId} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {item.productName} <span className="text-muted-foreground">× {item.quantity}</span>
                </span>
                <span>{formatCurrency((item.salePrice ?? item.price) * item.quantity)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex justify-between border-t pt-3 text-sm text-muted-foreground">
            <span>
              {shipment.courierName
                ? `${shipment.courierName}${shipment.trackingNumber ? ` · ${shipment.trackingNumber}` : ""}`
                : "Not yet booked with a courier"}
            </span>
            <span>Shipping {formatCurrency(shipment.shippingCost)}</span>
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        You see only the parcels that ship from your organisation. The buyer&apos;s full order may
        contain more.
      </p>
    </div>
  );
}
