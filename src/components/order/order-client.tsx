import Link from "next/link";
import { OrderSummary } from "@/components/order/order-summary";
import { Icon } from "@/components/ui/icon";
import { StatusBadge, type StatusTone } from "@/components/shared/badges/StatusBadge";
import { cn } from "@/lib/utils";
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
import { PageHeader } from "@/components/shared/page-shell";

const STATUS_LABELS: Record<string, { label: string; tone: StatusTone }> = {
  [ORDER_STATUS.PENDING_PAYMENT]: { label: "Awaiting payment", tone: "warning" },
  [ORDER_STATUS.CONFIRMED]: { label: "Confirmed", tone: "info" },
  [ORDER_STATUS.PROCESSING]: { label: "Being packed", tone: "info" },
  [ORDER_STATUS.PACKED]: { label: "Packed", tone: "info" },
  [ORDER_STATUS.SHIPPED]: { label: "On its way", tone: "success" },
  [ORDER_STATUS.DELIVERED]: { label: "Delivered", tone: "success" },
  [ORDER_STATUS.CANCELLED]: { label: "Cancelled", tone: "neutral" },
  [ORDER_STATUS.FAILED]: { label: "Payment failed", tone: "destructive" },
};

/** A parcel's journey as four steps; the courier's finer states fold into the one they belong to. */
export const PARCEL_STEPS = ["Packed", "Shipped", "Out for delivery", "Delivered"] as const;
const STEP_OF: Record<string, number> = {
  [SHIPMENT_STATUS.PACKING]: -1,
  [SHIPMENT_STATUS.READY_FOR_PICKUP]: 0,
  [SHIPMENT_STATUS.PICKUP_BOOKED]: 0,
  [SHIPMENT_STATUS.PICKED_UP]: 1,
  [SHIPMENT_STATUS.IN_TRANSIT]: 1,
  [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: 2,
  [SHIPMENT_STATUS.DELIVERY_FAILED]: 2,
  [SHIPMENT_STATUS.DELIVERED]: 3,
};

/** How far along the four steps a parcel is; null off the forward path (cancelled, returned, lost). */
export function parcelStep(status: string): number | null {
  return status in STEP_OF ? STEP_OF[status] : null;
}

function ParcelProgress({ status }: { status: string }) {
  const reached = parcelStep(status);
  if (reached === null) return null;
  return (
    <ol aria-label="Parcel progress" className="grid grid-cols-4 gap-1">
      {PARCEL_STEPS.map((label, i) => (
        <li key={label} aria-current={i === reached ? "step" : undefined} className="space-y-1.5">
          <span className={cn("block h-1 rounded-full", i <= reached ? "bg-primary" : "bg-muted")} />
          <span className={cn("block text-caption", i <= reached ? "text-foreground" : "text-muted-foreground", i === reached && "font-semibold")}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

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
    <section aria-label={`Parcel ${shipment.code}`} className="flex flex-col gap-3 rounded-card border border-border bg-card p-4 text-small">
      <div className="flex items-start gap-3">
        <Icon name="parcel" size="md" tone="muted" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground">{shipment.org?.name ? `From ${shipment.org.name}` : `Parcel ${shipment.code}`}</p>
          <p className="text-caption text-muted-foreground">
            {shipment.items.map((item) => `${item.productName} × ${item.quantity}`).join(", ")}
          </p>
        </div>
      </div>
      {eta && <p className="font-semibold">{BUYER_COPY.arrivesBy(eta)}</p>}
      <ParcelProgress status={shipment.status} />
      {shipment.trackingUrl && ARRIVING.includes(shipment.status) && (
        <Link
          href={shipment.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-1 self-start font-medium text-primary hover:underline"
        >
          {BUYER_COPY.track} <Icon name="external" size="xs" />
        </Link>
      )}
      {refundText && <p className="font-medium">{refundText}</p>}
      <details className="group">
        <summary className="min-h-10 cursor-pointer list-none py-2 text-caption font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            Every update <Icon name="expand" size="xs" />
          </span>
        </summary>
        <ParcelTimeline timeline={withRefund} reader={TIMELINE_READER.BUYER} />
      </details>
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
    </section>
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
      <PageHeader
        eyebrow={`Order ${order.code}`}
        back={viewerOwns ? { href: "/orders", label: "Your orders" } : undefined}
        actions={statusInfo && <StatusBadge tone={statusInfo.tone} dot>{statusInfo.label}</StatusBadge>}
        {...orderHeadline(order.status)}
      />

      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
        <div className="space-y-3">
          {order.shipments.length > 1 && <p className="text-small font-medium">{BUYER_COPY.parcels(order.shipments.length)}</p>}
          {order.shipments.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} timeline={timelines[shipment.id]} cancel={cancel} />
          ))}
          {cancelView.couponsBack.map((code) => (
            <p key={code} className="text-small">{BUYER_CANCEL_COPY.couponBack(code)}</p>
          ))}
        </div>

        <div className="space-y-4">
          {order.address && (
            <p className="flex items-start gap-2 rounded-card border border-border bg-card p-4 text-small text-muted-foreground">
              <Icon name="location" size="md" />
              <span>
                {order.address.fullName} · {order.address.city} {order.address.pincode}
              </span>
            </p>
          )}
          <OrderSummary order={order} showShare={true} />
          <div className="flex items-center gap-2 text-small text-muted-foreground">
            <Icon name="help" size="md" />
            <span>Need help with this order?</span>
            <ContactLauncher className="h-auto min-h-10 px-0 text-small font-medium text-primary hover:bg-transparent">Contact us</ContactLauncher>
          </div>
        </div>
      </div>
    </div>
  );
}
