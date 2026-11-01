import Link from "next/link";

import type { PickupQueueRow, PickupQueueTab } from "@server/checkout/pickup-queue";
import { PICKUP_QUEUE_TAB } from "@server/checkout/pickup-queue";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { formatPhone } from "@server/shared/phone";
import { cn } from "@/lib/utils";
import { PickupActions } from "./pickup-actions";
import { QUEUE_COPY, READY_AMBER_HOURS, parcelOf, pickupDue, readyFor, waitingFor } from "./pickups-copy";

/** ux.md "admin pickups", Ready and Booked: cards on phone and tablet, a table at `lg:`. Oldest first. */
export function PickupQueueList({
  rows,
  tab,
  filterHref,
}: {
  rows: PickupQueueRow[];
  tab: PickupQueueTab;
  /** The same tab narrowed to one shop or city (ux.md "Many items"). */
  filterHref: (filter: { shop?: string; city?: string }) => string;
}) {
  const status = tab === PICKUP_QUEUE_TAB.READY ? SHIPMENT_STATUS.READY_FOR_PICKUP : SHIPMENT_STATUS.PICKUP_BOOKED;
  const view = rows.map((row) => {
    const of = parcelOf(row.parcelCode, row.parcelsInOrder);
    const parcel = (
      <>
        <Link href={`/admin/orders/${row.orderId}`} prefetch={false} className="font-medium text-primary hover:underline">
          {row.parcelCode}
        </Link>
        {of && <span className="text-muted-foreground"> · {of}</span>}
      </>
    );
    const shop = (
      <span className="break-words">
        <Link href={filterHref({ shop: row.orgId })} prefetch={false} className="hover:underline">
          {row.shopName}
        </Link>
        {" · "}
        <Link href={filterHref({ city: row.city })} prefetch={false} className="hover:underline">
          {row.city}
        </Link>{" "}
        <strong>{row.pincode}</strong>
        {row.shopPhone ? ` · ${formatPhone(row.shopPhone)}` : ""}
      </span>
    );
    const amber = row.readyHours !== null && row.readyHours >= READY_AMBER_HOURS;
    const flag =
      tab === PICKUP_QUEUE_TAB.READY ? (
        amber ? (
          <span className="font-medium text-warning">
            {waitingFor(row.readyHours ?? 0)} · {readyFor(row.readyHours ?? 0)}
          </span>
        ) : null
      ) : row.daysOverdue > 0 ? (
        <span className="font-medium text-destructive">
          {pickupDue(row.daysOverdue)} · {QUEUE_COPY.noCourierUpdate}
        </span>
      ) : null;
    const booking =
      tab === PICKUP_QUEUE_TAB.BOOKED ? (
        <span className="break-words text-muted-foreground">
          {row.pickupDay} · {row.courierName} · {row.trackingNumber}
        </span>
      ) : null;
    const actions = <PickupActions parcel={{ ...row, status, pickupDay: row.pickupDay }} />;
    return { row, parcel, shop, flag, booking, actions };
  });

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 lg:hidden">
        {view.map(({ row, parcel, shop, flag, booking, actions }) => (
          <li key={row.shipmentId} className={cn("flex flex-col gap-2 rounded-card border bg-card p-4", flag && "border-warning")}>
            <div className="min-w-0 space-y-1 text-sm">
              <p>{parcel}</p>
              <p>{shop}</p>
              {booking && <p>{booking}</p>}
              {flag && <p>{flag}</p>}
            </div>
            {actions}
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Parcel</th>
            <th className="py-2">Pickup address</th>
            <th className="py-2">{tab === PICKUP_QUEUE_TAB.BOOKED ? "Booking" : "Waiting"}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {view.map(({ row, parcel, shop, flag, booking, actions }) => (
            <tr key={row.shipmentId}>
              <td className="py-2">{parcel}</td>
              <td className="max-w-xs py-2">{shop}</td>
              <td className="py-2">
                {booking}
                {flag && <div>{flag}</div>}
              </td>
              <td className="py-2 text-right">{actions}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
