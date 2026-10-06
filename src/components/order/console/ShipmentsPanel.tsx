"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, MapPin, Package, Pencil, Truck, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShipmentTrackingForm } from "@/components/shipping/ShipmentTrackingForm";
import { formatCurrency } from "@/lib/format";
import type { AdminShipmentView } from "@server/checkout/admin.order.types";
import { Money } from "@/components/shared/Money";
import {
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_EFFECTS,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";

/**
 * The parcels on an order, and the one control this screen has: entering or correcting an AWB.
 *
 * A client leaf under a server page ([ADR-0034]) — the whole screen used to be a client
 * component so that one toggle could work. `router.refresh()` re-runs the page's own read
 * instead of refetching the order over the wire.
 */
export function ShipmentsPanel({ shipments }: { shipments: AdminShipmentView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);

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
        const showTracking = shipment.trackingNumber && editing !== shipment.id;

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

            {showTracking ? (
              <div className="space-y-2 rounded-card border border-primary/30 bg-primary/10 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-medium text-primary">Tracking</h4>
                  <Button
                    variant="ghost"
                    onClick={() => setEditing(shipment.id)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/15"
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AWB number</span>
                    <span className="font-mono font-medium">{shipment.trackingNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Courier</span>
                    <span className="font-medium">{shipment.courierName || "—"}</span>
                  </div>
                  {shipment.trackingUrl && (
                    <a
                      href={shipment.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block pt-2 text-sm text-primary underline"
                    >
                      Track shipment →
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-t pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="flex items-center gap-2 text-sm font-medium text-warning">
                    <Clock className="size-4" />
                    {shipment.trackingNumber
                      ? "Update tracking"
                      : "Tracking required — add the AWB once the courier has it"}
                  </h4>
                  {shipment.trackingNumber && (
                    <Button
                      variant="ghost"
                      onClick={() => setEditing(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
                <ShipmentTrackingForm
                  shipmentId={shipment.id}
                  shipmentCode={shipment.code}
                  courierName={shipment.courierName ?? undefined}
                  existingTracking={
                    shipment.trackingNumber
                      ? {
                          trackingNumber: shipment.trackingNumber,
                          trackingUrl: shipment.trackingUrl ?? "",
                        }
                      : undefined
                  }
                  onSuccess={() => {
                    setEditing(null);
                    router.refresh();
                  }}
                />
              </div>
            )}
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
