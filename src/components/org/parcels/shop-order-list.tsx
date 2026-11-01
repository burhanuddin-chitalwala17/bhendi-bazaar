import Link from "next/link";

import { formatCurrency } from "@/lib/format";
import type { ShopOrderView } from "@server/checkout/shop-parcel.types";
import { SHOP_ORDERS_COPY, parcelOfLine } from "./parcel-copy";

/**
 * One row per parcel (ux.md "Shop orders", Partial): "Parcel 1 of 2 · Ready", the buyer as name,
 * city and pincode (Q22). Phone: cards; `md:` two columns; `lg:` a table.
 */
export function ShopOrderList({ orders, orderHref }: { orders: ShopOrderView[]; orderHref: (orderId: string) => string }) {
  const rows = orders.flatMap((order) => order.parcels.map((parcel) => ({ order, parcel })));
  const href = orderHref;
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
        {rows.map(({ order, parcel }) => (
          <li key={parcel.id}>
            <Link href={href(order.id)} prefetch={false} className="block min-h-11 rounded-card border bg-card p-4 hover:bg-muted">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{order.code}</span>
                <span className="text-sm">{formatCurrency(parcel.parcelValue)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{parcelOfLine(parcel.position, parcel.ofCount, parcel.status)}</p>
              <p className="line-clamp-2 break-words text-sm">{parcel.items.map((i) => i.productName).join(", ")}</p>
              <p className="text-sm text-muted-foreground">
                {order.buyer.name} · {order.buyer.city}, {order.buyer.pincode}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Order</th>
            <th className="py-2">Parcel</th>
            <th className="py-2">Items</th>
            <th className="py-2">Buyer</th>
            <th className="py-2 text-right">Your parcel value</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ order, parcel }) => (
            <tr key={parcel.id}>
              <td className="py-2 font-medium">{order.code}</td>
              <td className="py-2">{parcelOfLine(parcel.position, parcel.ofCount, parcel.status)}</td>
              <td className="max-w-xs py-2">
                <span className="line-clamp-2 break-words">{parcel.items.map((i) => i.productName).join(", ")}</span>
              </td>
              <td className="py-2">
                {order.buyer.name} · {order.buyer.city}, {order.buyer.pincode}
              </td>
              <td className="py-2 text-right">{formatCurrency(parcel.parcelValue)}</td>
              <td className="py-2 text-right">
                <Link href={href(order.id)} prefetch={false} className="text-primary hover:underline">
                  {SHOP_ORDERS_COPY.open}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
