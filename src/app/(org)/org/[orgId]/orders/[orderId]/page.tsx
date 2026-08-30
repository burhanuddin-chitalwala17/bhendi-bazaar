import Link from "next/link";
import { notFound } from "next/navigation";
import { orgOrdersDAL } from "@/data-access-layer/org/orders.dal";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";

export const metadata = { robots: { index: false, follow: false } };

const PAYMENT_BADGE = { paid: "paid", pending: "pending", failed: "failed" } as const;

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
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{order.code}</h1>
          <StatusBadge
            status={PAYMENT_BADGE[order.paymentStatus as keyof typeof PAYMENT_BADGE] ?? "default"}
          >
            {order.paymentStatus}
          </StatusBadge>
        </div>
        <Link href={`/org/${orgId}/orders`} className="text-sm text-primary hover:underline" prefetch={false}>
          ← All orders
        </Link>
      </div>
      <p className="text-muted-foreground">
        Placed {new Date(order.createdAt).toLocaleString("en-IN")}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Deliver to
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{order.address.fullName}</p>
          <p className="text-sm text-muted-foreground">
            {order.address.addressLine1}
            {order.address.addressLine2 ? `, ${order.address.addressLine2}` : ""}
            <br />
            {order.address.city}, {order.address.state} — {order.address.pincode}
            <br />
            {order.address.mobile}
          </p>
        </CardContent>
      </Card>

      {order.shipments.map((shipment, index) => (
        <Card key={shipment.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              {order.shipments.length > 1 ? `Parcel ${index + 1} — ` : ""}
              {shipment.code}
            </CardTitle>
            <StatusBadge status="default">{shipment.status}</StatusBadge>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {shipment.items.map((item) => (
                <li
                  key={`${item.productId}-${item.size ?? ""}-${item.color ?? ""}`}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span>
                    {item.productName}{" "}
                    {(item.size || item.color) && (
                      <span className="text-muted-foreground">
                        ({[item.size, item.color].filter(Boolean).join(", ")}){" "}
                      </span>
                    )}
                    <span className="text-muted-foreground">× {item.quantity}</span>
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
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground">
        You see only the parcels that ship from your organisation. The buyer&apos;s full order may
        contain more.
      </p>
    </div>
  );
}
