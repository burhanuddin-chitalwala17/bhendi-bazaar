import { CreditCard, Mail, MapPin, Phone, User } from "lucide-react";

import { formatCurrency } from "@/lib/format";
import { formatPhone } from "@server/shared/phone";
import type { AdminOrderDetail } from "@server/checkout/admin.order.types";
import { Money } from "@/components/shared/Money";

/** Everything about an order that is only ever read: who, where, and what it came to. */
export function OrderDetailAside({ order }: { order: AdminOrderDetail }) {
  const { address } = order;

  return (
    <div className="space-y-6">
      <Card title="Customer" icon={<User className="size-5" />}>
        <p className="font-medium">{address?.fullName || "Guest"}</p>
        {address?.mobile && (
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-muted-foreground/70" />
            {formatPhone(address.mobile)}
          </p>
        )}
        {address?.email && (
          <p className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground/70" />
            {address.email}
          </p>
        )}
      </Card>

      <Card title="Delivery address" icon={<MapPin className="size-5" />}>
        {address ? (
          <div className="space-y-1 text-foreground/80">
            <p>{address.addressLine1}</p>
            {address.addressLine2 && <p>{address.addressLine2}</p>}
            <p>
              {address.city}, {address.state} {address.pincode}
            </p>
            <p>{address.country}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">No address on this order.</p>
        )}
      </Card>

      <Card title="Order summary" icon={<CreditCard className="size-5" />}>
        <Row label="Items total" value={formatCurrency(order.itemsTotal)} />
        <Row label="Shipping" value={formatCurrency(order.shippingTotal)} />
        {order.discount > 0 && (
          <Row
            label="Discount"
            value={`-${formatCurrency(order.discount)}`}
            className="text-success"
          />
        )}
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <span>Grand total</span>
          <span><Money paise={order.grandTotal} /></span>
        </div>
      </Card>

      <div className="space-y-3 rounded-card border border-border bg-card p-6 text-sm">
        <Row label="Order date" value={order.createdAt.toLocaleDateString("en-IN")} />
        <Row label="Payment method" value={order.paymentMethod || "—"} />
        {order.paymentId && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Payment ID</span>
            <span className="font-mono">{order.paymentId}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-card border border-border bg-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {title}
      </h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between${className ? ` ${className}` : ""}`}>
      <span className={className ? undefined : "text-muted-foreground"}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
