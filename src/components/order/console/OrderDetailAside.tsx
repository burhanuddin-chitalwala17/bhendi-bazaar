import { Icon, type IconName } from "@/components/ui/icon";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { formatPhone } from "@server/shared/phone";
import type { AdminOrderDetail } from "@server/checkout/admin.order.types";
import { Money } from "@/components/shared/Money";

/** Everything about an order that is only ever read: who, where, and what it came to. */
export function OrderDetailAside({ order }: { order: AdminOrderDetail }) {
  const { address } = order;

  return (
    <div className="space-y-6">
      <Card title="Buyer" icon="account">
        <p className="font-medium">{address?.fullName || "Guest"}</p>
        {address?.mobile && (
          <p className="flex items-center gap-2">
            <Icon name="phone" tone="muted" />
            {formatPhone(address.mobile)}
          </p>
        )}
        {address?.email && (
          <p className="flex items-center gap-2">
            <Icon name="email" tone="muted" />
            {address.email}
          </p>
        )}
      </Card>

      <Card title="Delivery address" icon="location">
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

      <Card title="Order summary" icon="card">
        <Row label="Items total" value={formatCurrency(order.itemsTotal)} />
        <Row label="Shipping" value={formatCurrency(order.shippingTotal)} />
        {order.discount > 0 && (
          <Row
            label="Discount"
            value={`-${formatCurrency(order.discount)}`}
            className="text-success"
          />
        )}
        <div className="flex justify-between border-t border-border pt-2 text-body font-semibold">
          <span>Grand total</span>
          <span><Money paise={order.grandTotal} /></span>
        </div>
      </Card>

      <div className="space-y-3 rounded-card border border-border bg-card p-4 text-small md:p-6">
        <Row label="Order date" value={formatShortDate(order.createdAt)} />
        <Row label="Payment method" value={order.paymentMethod || "—"} />
        {order.paymentId && (
          <div className="flex justify-between gap-3 text-caption">
            <span className="text-muted-foreground">Payment ID</span>
            <span className="min-w-0 truncate font-mono">{order.paymentId}</span>
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
  icon: IconName;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-card border border-border bg-card p-4 md:p-6">
      <h2 className="flex items-center gap-2 text-title font-semibold">
        <Icon name={icon} size="md" tone="muted" />
        {title}
      </h2>
      <div className="space-y-2 text-small">{children}</div>
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
