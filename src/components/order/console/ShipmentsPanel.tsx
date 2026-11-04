import { Icon } from "@/components/ui/icon";
import { StatusBadge, type StatusTone } from "@/components/shared/badges/StatusBadge";
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
      <h2 className="flex items-center gap-2 text-title font-semibold">
        <Icon name="parcel" size="md" tone="muted" />
        Parcels
        <span className="text-small font-normal tabular-nums text-muted-foreground">{shipments.length}</span>
      </h2>

      {shipments.length === 0 && (
        <p className="rounded-card border border-border bg-card p-4 text-small text-muted-foreground md:p-6">
          Nothing has been packed for this order yet.
        </p>
      )}

      {shipments.map((shipment) => {
        return (
          <section
            key={shipment.id}
            className="space-y-4 rounded-card border border-border bg-card p-4 md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="mb-2 font-mono text-body font-semibold">{shipment.code}</h3>
                <div className="space-y-1 text-small text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Icon name="location" />
                    From {shipment.fromCity}, {shipment.fromState}
                  </p>
                  {shipment.packageWeight !== null && (
                    <p className="flex items-center gap-2">
                      <Icon name="parcel" />
                      {shipment.packageWeight} kg
                    </p>
                  )}
                  <p>Shipping: <Money paise={shipment.shippingCost} /></p>
                </div>
              </div>
              <StatusBadge tone={parcelTone(shipment.status)} dot>
                {SHIPMENT_STATUS_LABELS[shipment.status] ?? shipment.status}
              </StatusBadge>
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="mb-2 text-small font-medium">Items</h4>
              <div className="space-y-2">
                {shipment.items.map((item) => (
                  <div
                    key={`${item.productId}-${item.size ?? ""}-${item.color ?? ""}`}
                    className="flex justify-between gap-3 text-small"
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
              <div className="space-y-1 rounded-card border border-primary/30 bg-primary/10 p-4 text-small">
                {shipment.pickupDay && <p className="font-medium">Pickup {shipment.pickupDay}</p>}
                <p className="break-words">
                  {shipment.courierName ?? "—"} · <span className="font-mono">{shipment.trackingNumber}</span>
                </p>
                {shipment.trackingUrl && (
                  <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-primary underline">
                    Track parcel
                    <Icon name="external" size="xs" />
                  </a>
                )}
              </div>
            )}

            {paid && <PickupActions parcel={{ ...shipment, shipmentId: shipment.id }} />}

            <div className="border-t border-border pt-4">
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
function parcelTone(status: ShipmentStatus): StatusTone {
  if (status === SHIPMENT_STATUS.DELIVERED) return "success";
  if (SHIPMENT_STATUS_EFFECTS[status]?.refundOwed) return "destructive";
  if (status === SHIPMENT_STATUS.PACKING) return "warning";
  return "info";
}
