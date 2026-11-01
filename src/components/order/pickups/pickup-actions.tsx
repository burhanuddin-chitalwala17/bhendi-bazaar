import { SHIPMENT_STATUS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import { BookPickup } from "./book-pickup";
import { ChangePickupDate } from "./change-pickup-date";
import { MarkPickedUp } from "./mark-picked-up";

/** What the admin can do to a parcel at its stage (spec R5): book a ready one; re-date or collect a booked one. */
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
  };
}) {
  if (parcel.status === SHIPMENT_STATUS.READY_FOR_PICKUP) {
    return <BookPickup shipmentId={parcel.shipmentId} courierName={parcel.courierName} />;
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
    </div>
  );
}
