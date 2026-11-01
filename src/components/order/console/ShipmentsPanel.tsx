import { CheckCircle2, Clock, MapPin, Package, Truck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import type { AdminShipmentView } from "@server/checkout/admin.order.types";
import type { ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { Money } from "@/components/shared/Money";
import { PickupActions } from "@/components/order/pickups/pickup-actions";
import { ParcelTimeline } from "@/components/order/timeline/parcel-timeline";
import { TIMELINE_READER } from "@/components/order/timeline/timeline-copy";
import {
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_EFFECTS,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";

/**
 * The parcels on an order: each one's booking, its timeline, and what the admin can do at its
 * stage (order-fulfilment D11, D12) — book, re-date, mark picked up, cancel. A server component; the actions
 * are leaves ([ADR-0034]). The tracking form it held went with unit 3.
 */
export function ShipmentsPanel({
  shipments,
  timelines,
  paid,
}: {
  shipments: AdminShipmentView[];
  timelines: Record<string, ParcelTimelineDto>;
  /** Only a paid order's parcel can be cancelled (Q9, A8); an unpaid one shows no cancel. */
  paid: boolean;
}) {
  return (
    <div className="space-y-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Truck className="size-6" />
        Shipments ({shipments.length})
      </h2>

      {shipments.length === 0 && (
        <p className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
          Nothing has been packed for this order yet.
        </p>
      )}

      {shipments.map((shipment) => {
        return (
          <section
            key={shipment.id}
            className="space-y-4 rounded-card border border-border bg-card p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <StatusIcon status={shipment.status} />
                  <h3 className="text-lg font-semibold">{shipment.code}</h3>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    From: {shipment.fromCity}, {shipment.fromState}
                  </p>
                  {shipment.packageWeight !== null && (
                    <p className="flex items-center gap-2">
                      <Package className="size-4" />
                      Weight: {shipment.packageWeight}kg
                    </p>
                  )}
                  <p>Shipping: <Money paise={shipment.shippingCost} /></p>
                </div>
              </div>
              <Badge variant={badgeVariant(shipment.status)}>
                {SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status}
              </Badge>
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-medium">Items</h4>
              <div className="space-y-2">
                {shipment.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.size ?? ""}-${item.color ?? ""}`}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-foreground/80">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatCurrency((item.salePrice ?? item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {shipment.trackingNumber && (
              <div className="space-y-1 rounded-card border border-primary/30 bg-primary/10 p-4 text-sm">
                {shipment.pickupDay && <p className="font-medium">Pickup {shipment.pickupDay}</p>}
                <p className="break-words">
                  {shipment.courierName ?? "—"} · <span className="font-mono">{shipment.trackingNumber}</span>
                </p>
                {shipment.trackingUrl && (
                  <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-primary underline">
                    Track shipment →
                  </a>
                )}
              </div>
            )}

            {paid && <PickupActions parcel={{ ...shipment, shipmentId: shipment.id }} />}

            <div className="border-t pt-4">
              <ParcelTimeline timeline={timelines[shipment.id]} reader={TIMELINE_READER.ADMIN} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Tone follows the effects table, not a list of status names.
 *
 * A state that owes the buyer money is the one an operator must notice, and that is already
 * recorded once in `SHIPMENT_STATUS_EFFECTS` — reading it here means a new state gets the right
 * colour by describing what it costs, rather than by someone remembering to add a case.
 */
function badgeVariant(status: ShipmentStatus) {
  if (status === SHIPMENT_STATUS.DELIVERED) return "secondary" as const;
  return SHIPMENT_STATUS_EFFECTS[status]?.refundOwed ? ("destructive" as const) : ("outline" as const);
}

function StatusIcon({ status }: { status: ShipmentStatus }) {
  if (status === SHIPMENT_STATUS.DELIVERED) {
    return <CheckCircle2 className="size-5 text-success" aria-hidden />;
  }
  if (SHIPMENT_STATUS_EFFECTS[status]?.refundOwed) {
    return <XCircle className="size-5 text-destructive" aria-hidden />;
  }
  if (status === SHIPMENT_STATUS.PACKING) {
    return <Clock className="size-5 text-warning" aria-hidden />;
  }
  return <Package className="size-5 text-muted-foreground" aria-hidden />;
}
