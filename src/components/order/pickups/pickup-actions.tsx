import { SHIPMENT_STATUS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import { BookPickup } from "./book-pickup";
import { ChangePickupDate } from "./change-pickup-date";
import { MarkPickedUp } from "./mark-picked-up";
import { AdminCancelParcel } from "./admin-cancel-parcel";
import { ADMIN_CANCEL_COPY, SHIPROCKET_URL } from "./pickups-copy";

/**
 * What the admin can do to a parcel at its stage (spec R5, R10): book or cancel a ready one;
 * re-date, collect or cancel a booked one. A cancelled parcel that was booked keeps its Shiprocket
 * reminder (ux.md "admin cancel sheet": success after booking), read from its AWB, not a toast.
 */
export function PickupActions({
  parcel,
}: {
  parcel: {
    shipmentId: string;
    status: ShipmentStatus;
    courierName: string | null;
    pickupDate: string | null;
    pickupDay: string | null;
    estimatedDelivery: string | null;
    trackingNumber?: string | null;
  };
}) {
  if (parcel.status === SHIPMENT_STATUS.CANCELLED) {
    if (!parcel.trackingNumber) return null;
    return (
      <div className="space-y-1 rounded-card border border-warning/40 bg-warning/10 p-3 text-sm">
        <p className="font-medium">{ADMIN_CANCEL_COPY.successBooked(parcel.trackingNumber)}</p>
        <a href={SHIPROCKET_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center text-primary underline">
          {ADMIN_CANCEL_COPY.openShiprocket}
        </a>
      </div>
    );
  }
  if (parcel.status === SHIPMENT_STATUS.PACKING) return <AdminCancelParcel shipmentId={parcel.shipmentId} />;
  if (parcel.status === SHIPMENT_STATUS.READY_FOR_PICKUP) {
    return (
      <div className="flex flex-wrap gap-2">
        <BookPickup shipmentId={parcel.shipmentId} courierName={parcel.courierName} />
        <AdminCancelParcel shipmentId={parcel.shipmentId} />
      </div>
    );
  }
  if (parcel.status !== SHIPMENT_STATUS.PICKUP_BOOKED) return null;
  return (
    <div className="flex flex-wrap gap-2">
      <MarkPickedUp shipmentId={parcel.shipmentId} />
      {parcel.pickupDate && parcel.pickupDay && parcel.estimatedDelivery && (
        <ChangePickupDate
          // A refresh brings the new booked dates; a fresh form must open with them as "seen".
          key={`${parcel.pickupDate}/${parcel.estimatedDelivery}`}
          shipmentId={parcel.shipmentId}
          pickupDate={parcel.pickupDate}
          pickupDay={parcel.pickupDay}
          estimatedDelivery={parcel.estimatedDelivery}
        />
      )}
      <AdminCancelParcel shipmentId={parcel.shipmentId} />
    </div>
  );
}
