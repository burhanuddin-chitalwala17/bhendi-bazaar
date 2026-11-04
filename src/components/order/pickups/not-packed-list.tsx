"use client";

import Link from "next/link";
import { ROUTES } from "@server/shared/routes";

import type { NotPackedRow } from "@server/checkout/fulfilment-nudges";
import { NOTICE_KIND } from "@server/notifications/notice.types";
import { formatPhone } from "@server/shared/phone";
import { ResourceList } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { EmailShopButton } from "./email-shop-button";
import { AdminCancelParcel } from "./admin-cancel-parcel";
import { NOT_PACKED_COPY, NOT_PACKED_TAB, OVERDUE_RED_HOURS, nudgeLine, paidAgoLine, pickupsHref } from "./pickups-copy";
import { NOT_PACKED_LIST_COPY } from "./pickups-copy";

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
      label={NOT_PACKED_LIST_COPY.paidParcelsNotPacked}
      rows={rows}
      rowKey={(row) => row.shipmentId}
      tableFrom="lg"
      empty={{ title: NOT_PACKED_LIST_COPY.nothingLate, description: NOT_PACKED_COPY.empty }}
      columns={[
        {
          key: "parcel",
          label: NOT_PACKED_LIST_COPY.parcel,
          phone: "title",
          cell: (row) => (
            <Link href={ROUTES.admin.order(row.orderId)} prefetch={false} className="font-mono text-primary hover:underline">
              {row.parcelCode}
            </Link>
          ),
        },
        {
          key: "paid",
          label: NOT_PACKED_LIST_COPY.paid,
          phone: "status",
          cell: (row) => (
            <StatusBadge tone={row.hoursSincePaid > OVERDUE_RED_HOURS ? "destructive" : "warning"}>{paidAgoLine(row.hoursSincePaid)}</StatusBadge>
          ),
        },
        {
          key: "shop",
          label: NOT_PACKED_LIST_COPY.shop,
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
        { key: "emails", label: NOT_PACKED_LIST_COPY.emails, cell: (row) => <span className="text-muted-foreground">{nudges(row)}</span> },
        {
          key: "actions",
          label: NOT_PACKED_LIST_COPY.action,
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
