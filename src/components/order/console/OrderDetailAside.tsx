import { Icon, type IconName } from "@/components/ui/icon";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { formatPhone } from "@server/shared/phone";
import type { AdminOrderDetail } from "@server/checkout/admin.order.types";
import { Money } from "@/components/shared/Money";
import { ORDER_DETAIL_ASIDE_COPY } from "./console-copy";

/** Everything about an order that is only ever read: who, where, and what it came to. */
export function OrderDetailAside({ order }: { order: AdminOrderDetail }) {
  const { address } = order;

  return (
    <div className="space-y-6">
      <Card title={ORDER_DETAIL_ASIDE_COPY.buyer} icon="account">
        <p className="font-medium">{address?.fullName || ORDER_DETAIL_ASIDE_COPY.guest}</p>
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

      <Card title={ORDER_DETAIL_ASIDE_COPY.deliveryAddress} icon="location">
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
          <p className="text-muted-foreground">{ORDER_DETAIL_ASIDE_COPY.noAddressOrder}</p>
        )}
      </Card>

      <Card title={ORDER_DETAIL_ASIDE_COPY.orderSummary} icon="card">
        <Row label={ORDER_DETAIL_ASIDE_COPY.itemsTotal} value={formatCurrency(order.itemsTotal)} />
        <Row label={ORDER_DETAIL_ASIDE_COPY.shipping} value={formatCurrency(order.shippingTotal)} />
        {order.discount > 0 && (
          <Row
            label={ORDER_DETAIL_ASIDE_COPY.discount}
            value={`-${formatCurrency(order.discount)}`}
            className="text-success"
          />
        )}
        <div className="flex justify-between border-t border-border pt-2 text-body font-semibold">
          <span>{ORDER_DETAIL_ASIDE_COPY.grandTotal}</span>
          <span><Money paise={order.grandTotal} /></span>
        </div>
      </Card>

      <div className="space-y-3 rounded-card border border-border bg-card p-4 text-small md:p-6">
        <Row label={ORDER_DETAIL_ASIDE_COPY.orderDate} value={formatShortDate(order.createdAt)} />
        <Row label={ORDER_DETAIL_ASIDE_COPY.paymentMethod} value={order.paymentMethod || "—"} />
        {order.paymentId && (
          <div className="flex justify-between gap-3 text-caption">
            <span className="text-muted-foreground">{ORDER_DETAIL_ASIDE_COPY.paymentId}</span>
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
