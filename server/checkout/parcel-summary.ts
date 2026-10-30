import { SHIPMENT_STATUS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import { ORDER_STATUS, PARCEL_WITH_SHOP, type OrderStatus } from "@server/checkout/order.types";

const WITH_SHOP: ReadonlySet<string> = new Set<string>(PARCEL_WITH_SHOP);

/**
 * A paid order's status, read off its parcels (order-fulfilment Q5, D4). The migration
 * `20261031100100_parcel_vocabulary` holds its SQL twin; change both together.
 */
export function summariseParcels(statuses: readonly (ShipmentStatus | string)[]): OrderStatus | null {
  if (statuses.length === 0) return null;
  const live = statuses.filter((s) => s !== SHIPMENT_STATUS.CANCELLED);
  if (live.length === 0) return ORDER_STATUS.CANCELLED;
  if (live.every((s) => s === SHIPMENT_STATUS.DELIVERED)) return ORDER_STATUS.DELIVERED;
  if (live.some((s) => !WITH_SHOP.has(s))) return ORDER_STATUS.SHIPPED;
  return ORDER_STATUS.CONFIRMED;
}
