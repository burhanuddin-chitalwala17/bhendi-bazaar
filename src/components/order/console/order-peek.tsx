import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { Money } from "@/components/shared/Money";
import { formatDateTime } from "@/lib/format";
import type { AdminOrderDetail } from "@server/checkout/admin.order.types";
import { SHIPMENT_STATUS_LABELS } from "@server/shipping/domain/shipping.types";
import { orderChip, parcelTone, paymentChip } from "./order-status";

/**
 * One order beside the list, from desktop (AdminOrders, design-system Q36): enough to answer "what
 * is this and where is it", with the full page one tap away for anything that changes it. Every
 * figure is the server's, only formatted. A server component.
 */
export function OrderPeek({ order, closeHref }: { order: AdminOrderDetail; closeHref: string }) {
  const status = orderChip(order.status);
  const payment = paymentChip(order.paymentStatus);
  const { address } = order;

  return (
    <aside
      aria-label={`Order ${order.code}`}
      className="space-y-4 rounded-card border border-border bg-card p-5 shadow-raised"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="font-mono text-title font-semibold tabular-nums">{order.code}</h2>
          <p className="text-caption text-muted-foreground">
            Placed {formatDateTime(order.createdAt)}
            {order.paymentMethod ? ` · ${order.paymentMethod}` : ""}
          </p>
        </div>
        <Button asChild variant="ghost" shape="icon" size="sm" aria-label="Close order">
          <Link href={closeHref} scroll={false} prefetch={false}>
            <Icon name="close" />
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={status.tone} dot>{status.label}</StatusBadge>
        <StatusBadge tone={payment.tone}>{payment.label}</StatusBadge>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {order.shipments.map((parcel) => (
          <li key={parcel.id} className="space-y-2 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption text-muted-foreground">
                From {parcel.fromCity}
                {parcel.courierName ? ` · ${parcel.courierName}` : ""}
              </span>
              <StatusBadge tone={parcelTone(parcel.status)}>{SHIPMENT_STATUS_LABELS[parcel.status] ?? parcel.status}</StatusBadge>
            </div>
            {parcel.items.map((item) => (
              <div key={`${parcel.id}-${item.productId}`} className="flex items-center gap-3">
                <span className="relative size-12 shrink-0 overflow-hidden rounded-field bg-muted">
                  {item.thumbnail && <Image src={item.thumbnail} alt="" fill sizes="48px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-small font-medium">{item.productName}</span>
                  <span className="text-caption text-muted-foreground">
                    Qty {item.quantity}
                    {item.size ? ` · ${item.size}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>

      <div className="space-y-1">
        <p className="text-caption text-muted-foreground">Deliver to</p>
        <p className="text-small">
          {address ? `${address.fullName || "Guest"} · ${address.city} ${address.pincode}` : "No address on this order"}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-small">
        <span className="font-semibold">Total</span>
        <Money paise={order.grandTotal} className="font-semibold" />
      </div>

      <Button asChild variant="outline" className="w-full">
        <Link href={`/admin/orders/${order.id}`} prefetch={false}>
          Open full order
          <Icon name="forward" size="sm" />
        </Link>
      </Button>
    </aside>
  );
}
