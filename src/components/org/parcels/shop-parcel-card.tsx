import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import type { ShopParcelView } from "@server/checkout/shop-parcel.types";
import { SHOP_CANCEL_COPY, SHOP_PARCEL_COPY, SHOP_STATUS_LINE, parcelOfLine } from "./parcel-copy";
import { CancelParcel } from "./cancel-parcel";
import { ReadyForPickup } from "./ready-for-pickup";
import { ParcelLines } from "./parcel-lines";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { ParcelTimeline } from "@/components/order/timeline/parcel-timeline";
import { TIMELINE_READER } from "@/components/order/timeline/timeline-copy";

/**
 * One of the shop's own parcels (ux.md "Shop parcel"): its next action, its state line, and
 * its lines. The buyer is name, city and pincode only (Q22).
 */
export function ShopParcelCard({
  orgId,
  parcel,
  firstOrder,
  docked,
  timeline,
  feeNowPaise,
  feePaise = 0,
}: {
  orgId: string;
  parcel: ShopParcelView;
  firstOrder: boolean;
  docked: boolean;
  timeline?: ParcelTimelineDto;
  /** The fee a cancel would charge now, for the sheet's first line (ux.md "Shop cancel sheet"). */
  feeNowPaise: number;
  /** What this parcel's cancel charged, for the cancelled card's fee line. */
  feePaise?: number;
}) {
  const packing = parcel.status === SHIPMENT_STATUS.PACKING;
  const justReady = parcel.status === SHIPMENT_STATUS.READY_FOR_PICKUP;
  // The label opens only through our route, and only until the courier collects (Q26).
  const booked = parcel.status === SHIPMENT_STATUS.PICKUP_BOOKED;
  // Shown until the courier collects: while packing it cancels, once ready it explains why not (A7).
  const cancellable = packing || justReady || booked;
  const cancelled = parcel.status === SHIPMENT_STATUS.CANCELLED;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-base">{parcel.code}</CardTitle>
          <p className="text-small text-muted-foreground">{parcelOfLine(parcel.position, parcel.ofCount, parcel.status)}</p>
        </div>
        {packing ? (
          <ReadyForPickup orgId={orgId} shipmentId={parcel.id} firstOrder={firstOrder} docked={docked} />
        ) : (
          <StatusBadge tone={justReady ? "success" : "neutral"}>{SHOP_STATUS_LINE[parcel.status]}</StatusBadge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {justReady && <p className="text-small font-medium text-success">{SHOP_PARCEL_COPY.successReady}</p>}
        {booked && parcel.pickupDay && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border bg-muted/40 p-3">
            <p className="break-words text-small font-medium">
              {SHOP_PARCEL_COPY.booked(parcel.pickupDay, parcel.courierName, parcel.trackingNumber)}
            </p>
            <Button asChild variant="outline" size="sm" className="min-h-10">
              <a href={`/api/org/${orgId}/shipments/${parcel.id}/label`} download>
                <Icon name="download" size="sm" />
                {SHOP_PARCEL_COPY.downloadLabel}
              </a>
            </Button>
          </div>
        )}
        {cancelled && feePaise > 0 && <p className="text-small text-muted-foreground">{SHOP_CANCEL_COPY.feeLine(feePaise)}</p>}
        <ParcelLines items={parcel.items} />
        <ParcelTimeline timeline={timeline} reader={TIMELINE_READER.SHOP} />
        {cancellable && <CancelParcel orgId={orgId} shipmentId={parcel.id} packing={packing} feeNowPaise={feeNowPaise} />}
        <div className="flex justify-between border-t pt-3 text-small text-muted-foreground">
          <span>{parcel.courierName ? `${parcel.courierName}${parcel.trackingNumber ? ` · ${parcel.trackingNumber}` : ""}` : SHOP_STATUS_LINE[parcel.status]}</span>
          <span>{formatCurrency(parcel.parcelValue)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
