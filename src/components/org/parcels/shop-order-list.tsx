import type { ShopOrderView } from "@server/checkout/shop-parcel.types";
import { ShopOrderRows } from "./shop-order-rows";

/**
 * A shop's parcels, one row each. A server component, so a caller may pass where a row opens as a
 * function; the rows themselves are the client list. `orgId` is the shop looking at its own orders.
 */
export function ShopOrderList({
  orders,
  orderHref,
  orgId,
}: {
  orders: ShopOrderView[];
  orderHref: (orderId: string) => string;
  orgId?: string;
}) {
  const rows = orders.flatMap((order) => order.parcels.map((parcel) => ({ order, parcel, href: orderHref(order.id) })));
  return <ShopOrderRows rows={rows} orgId={orgId} />;
}
