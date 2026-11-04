import Link from "next/link";
import { Package, Truck, MapPin, ExternalLink } from "lucide-react";
import { OrderSummary } from "@/components/order/order-summary";
import { SectionHeader } from "../shared/SectionHeader";
import { Badge } from "@/components/ui/badge";
import type { Order, Shipment } from "@/domain/order";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import type { BuyerCancelView } from "@server/checkout/buyer-cancel-view";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { BuyerCancel } from "./buyer-cancel";
import { BUYER_CANCEL_COPY } from "./buyer-cancel-copy";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { calendarDay } from "@server/shared/india-time";
import type { ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { PARCEL_REFUND } from "@server/checkout/parcel-cancel.types";
import { ParcelTimeline } from "@/components/order/timeline/parcel-timeline";
import { TIMELINE_READER } from "@/components/order/timeline/timeline-copy";
import { orderHeadline } from "./order-headline";

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

/** Until the courier collects, a cancel either runs or explains why not (Q9, A7). */
const BEFORE_PICKUP: readonly string[] = [SHIPMENT_STATUS.PACKING, SHIPMENT_STATUS.READY_FOR_PICKUP, SHIPMENT_STATUS.PICKUP_BOOKED];

/** Who may act on a parcel here: the signed-in owner cancels; a guest is pointed to Contact us (Q31). */
interface CancelContext {
  orderId: string;
  paid: boolean;
  viewerOwns: boolean;
  multiParcel: boolean;
  view: BuyerCancelView;
}

/** The refund line under a parcel that is owed one (ux.md "Success: cancelled"). */
function refundLine(refund: BuyerCancelView["refunds"][string] | undefined): string | null {
  if (!refund) return null;
  if (refund.started && refund.startedDay) return BUYER_CANCEL_COPY.refundStarted(refund.amountPaise, refund.startedDay);
  return BUYER_CANCEL_COPY.refundOnItsWay(refund.amountPaise);
}

/** One parcel for its buyer (order-fulfilment R7, R10): the arrival day, the courier link, its timeline, its cancel. */
function ShipmentCard({ shipment, timeline, cancel }: { shipment: Shipment; timeline?: ParcelTimelineDto; cancel: CancelContext }) {
  const eta = shipment.estimatedDelivery && ARRIVING.includes(shipment.status) ? calendarDay(new Date(shipment.estimatedDelivery)) : null;
  const refund = cancel.view.refunds[shipment.id];
  // A lost, damaged or returned parcel's refund shows once started (R14, Q25); until then its timeline says we'll be in touch.
  const refundText =
    shipment.status === SHIPMENT_STATUS.CANCELLED ? refundLine(refund) : refund?.started ? refundLine(refund) : null;
  // A8: an unpaid order shows no cancel anywhere; it expires as today.
  const canAct = cancel.paid && BEFORE_PICKUP.includes(shipment.status);
  // A cancel that owed ₹0 writes no refund row, so its timeline says plain "Cancelled".
  const refundState = !refund ? PARCEL_REFUND.NONE : refund.started ? PARCEL_REFUND.STARTED : PARCEL_REFUND.OWED;
  const withRefund = timeline ? { ...timeline, refund: refundState } : timeline;
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
      {refundText && <p className="font-medium">{refundText}</p>}
      <ParcelTimeline timeline={withRefund} reader={TIMELINE_READER.BUYER} />
      {canAct && cancel.viewerOwns && (
        <BuyerCancel
          orderId={cancel.orderId}
          shipmentId={shipment.id}
          packing={shipment.status === SHIPMENT_STATUS.PACKING}
          multiParcel={cancel.multiParcel}
          shopName={shipment.org?.name ?? null}
          refundPaise={cancel.view.preview[shipment.id] ?? 0}
        />
      )}
      {canAct && !cancel.viewerOwns && (
        <ContactLauncher className="min-h-11 w-full border sm:w-auto">{BUYER_CANCEL_COPY.contactUs}</ContactLauncher>
      )}
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
  cancelView: BuyerCancelView;
  /** The signed-in viewer owns this order; only then can it be cancelled here (Q31). */
  viewerOwns: boolean;
}

export function OrderClient({ order, timelines, cancelView, viewerOwns }: OrderClientProps) {
  const statusInfo = STATUS_LABELS[order.status];
  const cancel: CancelContext = {
    orderId: order.id,
    paid: order.paymentStatus === PAYMENT_STATUS.PAID,
    viewerOwns,
    multiParcel: order.shipments.length > 1,
    view: cancelView,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <SectionHeader as="h1" overline="Order" {...orderHeadline(order.status)} />
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
              <ShipmentCard key={shipment.id} shipment={shipment} timeline={timelines[shipment.id]} cancel={cancel} />
            ))}
            {cancelView.couponsBack.map((code) => (
              <p key={code} className="text-sm">{BUYER_CANCEL_COPY.couponBack(code)}</p>
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
