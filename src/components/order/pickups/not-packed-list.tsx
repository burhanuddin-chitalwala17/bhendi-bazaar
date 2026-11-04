"use client";

import Link from "next/link";

import type { NotPackedRow } from "@server/checkout/fulfilment-nudges";
import { NOTICE_KIND } from "@server/notifications/notice.types";
import { formatPhone } from "@server/shared/phone";
import { ResourceList } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { EmailShopButton } from "./email-shop-button";
import { AdminCancelParcel } from "./admin-cancel-parcel";
import { NOT_PACKED_COPY, NOT_PACKED_TAB, OVERDUE_RED_HOURS, nudgeLine, paidAgoLine, pickupsHref } from "./pickups-copy";

/** ux.md "admin not-packed flag": rows on phone and tablet, a table at `lg:`. */
export function NotPackedList({ rows, now }: { rows: NotPackedRow[]; now: number }) {
  const nudges = (row: NotPackedRow) => {
    const emailedHoursAgo = row.adminEmailedAt ? Math.floor((now - new Date(row.adminEmailedAt).getTime()) / 3_600_000) : null;
    return nudgeLine(
      { h12: row.nudges.includes(NOTICE_KIND.NOT_READY_12H), h24: row.nudges.includes(NOTICE_KIND.NOT_READY_24H) },
      emailedHoursAgo,
    );
  };

  return (
    <ResourceList
      label="Paid parcels not packed"
      rows={rows}
      rowKey={(row) => row.shipmentId}
      tableFrom="lg"
      empty={{ title: "Nothing late", description: NOT_PACKED_COPY.empty }}
      columns={[
        {
          key: "parcel",
          label: "Parcel",
          phone: "title",
          cell: (row) => (
            <Link href={`/admin/orders/${row.orderId}`} prefetch={false} className="font-mono text-primary hover:underline">
              {row.parcelCode}
            </Link>
          ),
        },
        {
          key: "paid",
          label: "Paid",
          phone: "status",
          cell: (row) => (
            <StatusBadge tone={row.hoursSincePaid > OVERDUE_RED_HOURS ? "destructive" : "warning"}>{paidAgoLine(row.hoursSincePaid)}</StatusBadge>
          ),
        },
        {
          key: "shop",
          label: "Shop",
          phone: "meta",
          cell: (row) => (
            <span className="whitespace-normal">
              <Link href={pickupsHref(NOT_PACKED_TAB, { shop: row.orgId })} prefetch={false} className="hover:underline">
                {row.shopName}
              </Link>
              {" · "}
              {row.city}
              {row.shopPhone ? ` · ${formatPhone(row.shopPhone)}` : ""}
            </span>
          ),
        },
        { key: "emails", label: "Emails", cell: (row) => <span className="text-muted-foreground">{nudges(row)}</span> },
        {
          key: "actions",
          label: "Action",
          align: "end",
          phone: "trailing",
          cell: (row) => (
            <div className="flex flex-wrap justify-end gap-2">
              <EmailShopButton shipmentId={row.shipmentId} />
              <AdminCancelParcel shipmentId={row.shipmentId} />
            </div>
          ),
        },
      ]}
    />
  );
}
