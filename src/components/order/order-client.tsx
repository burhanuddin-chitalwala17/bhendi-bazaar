import Link from "next/link";
import { Package, Truck, MapPin, ExternalLink } from "lucide-react";
import { OrderSummary } from "@/components/order/order-summary";
import { SectionHeader } from "../shared/SectionHeader";
import { Badge } from "@/components/ui/badge";
import type { Order, Shipment } from "@/domain/order";
import { ORDER_STATUS } from "@server/checkout/order.types";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { calendarDay } from "@server/shared/india-time";
import type { ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { ParcelTimeline } from "@/components/order/timeline/parcel-timeline";
import { TIMELINE_READER } from "@/components/order/timeline/timeline-copy";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  [ORDER_STATUS.PENDING_PAYMENT]: { label: "Awaiting Payment", className: "bg-warning text-warning-foreground" },
  [ORDER_STATUS.CONFIRMED]: { label: "Confirmed", className: "bg-info text-info-foreground" },
  [ORDER_STATUS.PROCESSING]: { label: "Processing", className: "bg-info text-info-foreground" },
  [ORDER_STATUS.PACKED]: { label: "Packed", className: "bg-primary text-primary-foreground" },
  [ORDER_STATUS.SHIPPED]: { label: "Shipped", className: "bg-primary text-primary-foreground" },
  [ORDER_STATUS.DELIVERED]: { label: "Delivered", className: "bg-success text-success-foreground" },
  [ORDER_STATUS.CANCELLED]: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  [ORDER_STATUS.FAILED]: { label: "Payment Failed", className: "bg-destructive text-destructive-foreground" },
};

/** The states a booked arrival day is still worth promising in (ux.md "Success: booked"). */
const ARRIVING: readonly string[] = [
  SHIPMENT_STATUS.PICKUP_BOOKED,
  SHIPMENT_STATUS.PICKED_UP,
  SHIPMENT_STATUS.IN_TRANSIT,
  SHIPMENT_STATUS.OUT_FOR_DELIVERY,
  SHIPMENT_STATUS.DELIVERY_FAILED,
];

/** One parcel for its buyer (order-fulfilment R7): the arrival day, the courier link, its timeline. */
function ShipmentCard({ shipment, timeline }: { shipment: Shipment; timeline?: ParcelTimelineDto }) {
  const eta = shipment.estimatedDelivery && ARRIVING.includes(shipment.status) ? calendarDay(new Date(shipment.estimatedDelivery)) : null;
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border/70 bg-muted/30 p-3 text-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Truck className="h-3.5 w-3.5" />
        <span>Shipment {shipment.code}</span>
      </div>
      {eta && <p className="font-medium">{BUYER_COPY.arrivesBy(eta)}</p>}
      {shipment.trackingUrl && ARRIVING.includes(shipment.status) && (
        <Link
          href={shipment.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1 text-sm text-primary hover:underline"
        >
          {BUYER_COPY.track} <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      <ParcelTimeline timeline={timeline} reader={TIMELINE_READER.BUYER} />
    </div>
  );
}

/** order-fulfilment ux.md "buyer order". */
const BUYER_COPY = {
  arrivesBy: (day: string) => `Arrives by ${day}`,
  track: "Track parcel",
  parcels: (n: number) => `Arriving in ${n} parcels`,
} as const;

interface OrderClientProps {
  order: Order;
  timelines: Record<string, ParcelTimelineDto>;
}

export function OrderClient({ order, timelines }: OrderClientProps) {
  const statusInfo = STATUS_LABELS[order.status];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <SectionHeader
          overline="Order"
          title="Thank you for shopping at Bhendi Bazaar"
          description="Your order has been placed successfully."
        />
      </header>

      {/* Order status + tracking */}
      <section className="space-y-3 rounded-card border border-border/70 bg-card/80 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Order Status</span>
          </div>
          {statusInfo && (
            <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
          )}
        </div>

        {order.address && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {order.address.fullName}, {order.address.city}{" "}
              {order.address.pincode}
            </span>
          </div>
        )}

        {order.shipments.length > 0 && (
          <div className="space-y-2 pt-1">
            {order.shipments.length > 1 && <p className="text-sm font-medium">{BUYER_COPY.parcels(order.shipments.length)}</p>}
            {order.shipments.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} timeline={timelines[shipment.id]} />
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <OrderSummary order={order} showShare={true} />
      </div>
    </div>
  );
}
