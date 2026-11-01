import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import type { ShopParcelView } from "@server/checkout/shop-parcel.types";
import { SHOP_PARCEL_COPY, SHOP_STATUS_LINE, parcelOfLine } from "./parcel-copy";
import { ReadyForPickup } from "./ready-for-pickup";
import { ParcelLines } from "./parcel-lines";

/**
 * One of the shop's own parcels (ux.md "Shop parcel"): its next action, its state line, and
 * its lines. The buyer is name, city and pincode only (Q22).
 */
export function ShopParcelCard({
  orgId,
  parcel,
  firstOrder,
  docked,
}: {
  orgId: string;
  parcel: ShopParcelView;
  firstOrder: boolean;
  docked: boolean;
}) {
  const packing = parcel.status === SHIPMENT_STATUS.PACKING;
  const justReady = parcel.status === SHIPMENT_STATUS.READY_FOR_PICKUP;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{parcel.code}</CardTitle>
          <p className="text-sm text-muted-foreground">{parcelOfLine(parcel.position, parcel.ofCount, parcel.status)}</p>
        </div>
        {packing ? (
          <ReadyForPickup orgId={orgId} shipmentId={parcel.id} firstOrder={firstOrder} docked={docked} />
        ) : (
          <StatusBadge status={justReady ? "paid" : "default"}>{SHOP_STATUS_LINE[parcel.status]}</StatusBadge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {justReady && <p className="text-sm font-medium text-success">{SHOP_PARCEL_COPY.successReady}</p>}
        <ParcelLines items={parcel.items} />
        <div className="flex justify-between border-t pt-3 text-sm text-muted-foreground">
          <span>{parcel.courierName ? `${parcel.courierName}${parcel.trackingNumber ? ` · ${parcel.trackingNumber}` : ""}` : SHOP_STATUS_LINE[parcel.status]}</span>
          <span>{formatCurrency(parcel.parcelValue)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
