"use client";

import Link from "next/link";
import { ROUTES } from "@server/shared/routes";

import type { PickupQueueRow, PickupQueueTab } from "@server/checkout/pickup-queue.types";
import { PICKUP_QUEUE_TAB } from "@server/checkout/pickup-queue.types";
import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";
import { formatPhone } from "@server/shared/phone";
import { ResourceList } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { PickupActions } from "./pickup-actions";
import { QUEUE_COPY, READY_AMBER_HOURS, parcelOf, pickupDue, pickupsHref, readyFor, waitingFor } from "./pickups-copy";
import { PICKUP_QUEUE_LIST_COPY } from "./pickups-copy";

/** ux.md "admin pickups", Ready and Booked: rows on phone and tablet, a table at `lg:`. Oldest first. */
export function PickupQueueList({
  rows,
  tab,
  filter,
}: {
  rows: PickupQueueRow[];
  tab: PickupQueueTab;
  /** The filters in force; a shop or city link narrows the same tab (ux.md "Many items"). */
  filter: { shop?: string; city?: string };
}) {
  const status = tab === PICKUP_QUEUE_TAB.READY ? SHIPMENT_STATUS.READY_FOR_PICKUP : SHIPMENT_STATUS.PICKUP_BOOKED;
  const narrow = (f: { shop?: string; city?: string }) => pickupsHref(tab, { ...filter, ...f });

  return (
    <ResourceList
      label={tab === PICKUP_QUEUE_TAB.READY ? PICKUP_QUEUE_LIST_COPY.parcelsReadyBook : PICKUP_QUEUE_LIST_COPY.bookedPickups}
      rows={rows}
      rowKey={(row) => row.shipmentId}
      tableFrom="lg"
      empty={{ title: PICKUP_QUEUE_LIST_COPY.nothingWaiting, description: QUEUE_COPY.empty }}
      columns={[
        {
          key: "parcel",
          label: PICKUP_QUEUE_LIST_COPY.parcel,
          phone: "title",
          cell: (row) => {
            const of = parcelOf(row.parcelCode, row.parcelsInOrder);
            return (
              <>
                <Link href={ROUTES.admin.order(row.orderId)} prefetch={false} className="font-mono text-primary hover:underline">
                  {row.parcelCode}
                </Link>
                {of && <span className="font-normal text-muted-foreground"> · {of}</span>}
              </>
            );
          },
        },
        {
          key: "address",
          label: PICKUP_QUEUE_LIST_COPY.pickupAddress,
          phone: "meta",
          cell: (row) => (
            <span className="whitespace-normal">
              <Link href={narrow({ shop: row.orgId })} prefetch={false} className="hover:underline">
                {row.shopName}
              </Link>
              {" · "}
              <Link href={narrow({ city: row.city })} prefetch={false} className="hover:underline">
                {row.city}
              </Link>{" "}
              <span className="font-medium">{row.pincode}</span>
              {row.shopPhone ? ` · ${formatPhone(row.shopPhone)}` : ""}
            </span>
          ),
        },
        {
          key: "when",
          label: tab === PICKUP_QUEUE_TAB.BOOKED ? PICKUP_QUEUE_LIST_COPY.booking : PICKUP_QUEUE_LIST_COPY.waiting,
          cell: (row) => {
            if (tab === PICKUP_QUEUE_TAB.READY) {
              const hours = row.readyHours ?? 0;
              return row.readyHours !== null && hours >= READY_AMBER_HOURS ? (
                <StatusBadge tone="warning">
                  {waitingFor(hours)} · {readyFor(hours)}
                </StatusBadge>
              ) : (
                <span className="text-muted-foreground">{waitingFor(hours)}</span>
              );
            }
            return (
              <span className="flex flex-col gap-1 whitespace-normal">
                <span className="text-muted-foreground">
                  {row.pickupDay} · {row.courierName} · <span className="font-mono">{row.trackingNumber}</span>
                </span>
                {row.daysOverdue > 0 && (
                  <StatusBadge tone="destructive">
                    {pickupDue(row.daysOverdue)} · {QUEUE_COPY.noCourierUpdate}
                  </StatusBadge>
                )}
              </span>
            );
          },
        },
        {
          key: "actions",
          label: PICKUP_QUEUE_LIST_COPY.action,
          align: "end",
          phone: "trailing",
          cell: (row) => <PickupActions parcel={{ ...row, status, pickupDay: row.pickupDay }} />,
        },
      ]}
    />
  );
}
