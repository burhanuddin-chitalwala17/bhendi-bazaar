import Link from "next/link";
import { Package, Truck, MapPin, ExternalLink } from "lucide-react";
import { OrderSummary } from "@/components/order/order-summary";
import { SectionHeader } from "../shared/SectionHeader";
import { Badge } from "@/components/ui/badge";
import type { Order, Shipment } from "@/domain/order";
import { ORDER_STATUS } from "@server/checkout/order.types";
import { formatDay } from "@/lib/format";

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

function ShipmentCard({ shipment }: { shipment: Shipment }) {
  const hasTracking = shipment.trackingNumber || shipment.courierName;
  if (!hasTracking) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-border/70 bg-muted/30 p-3 text-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Truck className="h-3.5 w-3.5" />
        <span>Shipment {shipment.code}</span>
      </div>
      {shipment.courierName && (
        <p className="text-xs">
          <span className="text-muted-foreground">Courier:</span>{" "}
          {shipment.courierName}
        </p>
      )}
      {shipment.trackingNumber && (
        <p className="text-xs">
          <span className="text-muted-foreground">AWB:</span>{" "}
          <span className="font-mono">{shipment.trackingNumber}</span>
        </p>
      )}
      {shipment.trackingUrl && (
        <Link
          href={shipment.trackingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Track shipment <ExternalLink className="h-3 w-3" />
        </Link>
      )}
      {shipment.estimatedDelivery && (
        <p className="text-xs">
          <span className="text-muted-foreground">Est. delivery:</span>{" "}
          {formatDay(shipment.estimatedDelivery)}
        </p>
      )}
    </div>
  );
}

interface OrderClientProps {
  order: Order;
}

export function OrderClient({ order }: OrderClientProps) {
  const statusInfo = STATUS_LABELS[order.status];
  const shipmentsWithTracking = order.shipments.filter(
    (s) => s.trackingNumber || s.courierName,
  );

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

        {shipmentsWithTracking.length > 0 && (
          <div className="space-y-2 pt-1">
            {shipmentsWithTracking.map((shipment) => (
              <ShipmentCard key={shipment.id} shipment={shipment} />
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
