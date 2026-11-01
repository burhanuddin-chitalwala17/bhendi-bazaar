import Link from "next/link";

import type { NotPackedRow } from "@server/checkout/fulfilment-nudges";
import { NOTICE_KIND } from "@server/notifications/notice.types";
import { formatPhone } from "@server/shared/phone";
import { cn } from "@/lib/utils";
import { EmailShopButton } from "./email-shop-button";
import { OVERDUE_RED_HOURS, nudgeLine, paidAgoLine } from "./pickups-copy";

/** ux.md "admin not-packed flag": cards on phone and tablet, a table at `lg:`. */
export function NotPackedList({ rows, now }: { rows: NotPackedRow[]; now: number }) {
  const view = rows.map((row) => {
    const emailedHoursAgo = row.adminEmailedAt ? Math.floor((now - new Date(row.adminEmailedAt).getTime()) / 3_600_000) : null;
    const nudges = nudgeLine(
      { h12: row.nudges.includes(NOTICE_KIND.NOT_READY_12H), h24: row.nudges.includes(NOTICE_KIND.NOT_READY_24H) },
      emailedHoursAgo,
    );
    const age = (
      <span className={cn(row.hoursSincePaid > OVERDUE_RED_HOURS && "font-medium text-destructive")}>{paidAgoLine(row.hoursSincePaid)}</span>
    );
    const parcel = (
      <Link href={`/admin/orders/${row.orderId}`} prefetch={false} className="font-medium text-primary hover:underline">
        {row.parcelCode}
      </Link>
    );
    const shop = (
      <>
        <Link href={`/admin/orders/pickups?tab=not-packed&shop=${row.orgId}`} className="hover:underline">
          {row.shopName}
        </Link>
        {" · "}
        {row.city}
        {row.shopPhone ? ` · ${formatPhone(row.shopPhone)}` : ""}
      </>
    );
    return { row, nudges, age, parcel, shop };
  });

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 lg:hidden">
        {view.map(({ row, nudges, age, parcel, shop }) => (
          <li key={row.shipmentId} className="flex flex-col gap-2 rounded-card border bg-card p-4">
            <div className="min-w-0 space-y-1 text-sm">
              {parcel}
              <p>{age}</p>
              <p className="break-words">{shop}</p>
              <p className="text-muted-foreground">{nudges}</p>
            </div>
            <EmailShopButton shipmentId={row.shipmentId} />
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Parcel</th>
            <th className="py-2">Paid</th>
            <th className="py-2">Shop</th>
            <th className="py-2">Emails</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {view.map(({ row, nudges, age, parcel, shop }) => (
            <tr key={row.shipmentId}>
              <td className="py-2">{parcel}</td>
              <td className="py-2">{age}</td>
              <td className="max-w-xs break-words py-2">{shop}</td>
              <td className="py-2 text-muted-foreground">{nudges}</td>
              <td className="py-2 text-right">
                <EmailShopButton shipmentId={row.shipmentId} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
