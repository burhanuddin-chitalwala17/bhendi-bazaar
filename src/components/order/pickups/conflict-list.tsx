"use client";

import Link from "next/link";
import { ROUTES } from "@server/shared/routes";

import type { CourierConflictRow } from "@server/shipping/courier-conflict.service";
import { COURIER_CONFLICT_KIND } from "@server/shipping/domain/shipping.types";
import { indiaMoment } from "@server/shared/india-time";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ResourceList } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { ConflictDetails, DismissConflict } from "./conflict-actions";
import { CONFLICT_COPY, SHIPROCKET_URL } from "./pickups-copy";
import { CONFLICT_LIST_COPY } from "./pickups-copy";

function lineOf(row: CourierConflictRow): string {
  return row.kind === COURIER_CONFLICT_KIND.CANCELLED_PARCEL
    ? CONFLICT_COPY.cancelledParcel(row.parcelCode ?? row.awb, row.courierWording)
    : CONFLICT_COPY.unknownAwb(row.awb, indiaMoment(new Date(row.receivedAt)));
}

function meta(row: CourierConflictRow): string {
  return [row.updates > 1 ? CONFLICT_COPY.updates(row.updates) : null, row.dismissed ? CONFLICT_COPY.dismissedBy(row.dismissedByName ?? "staff") : null]
    .filter(Boolean)
    .join(" · ");
}

function Actions({ row }: { row: CourierConflictRow }) {
  if (row.dismissed) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {row.kind === COURIER_CONFLICT_KIND.CANCELLED_PARCEL ? (
        <Button asChild size="sm" variant="outline">
          <a href={SHIPROCKET_URL} target="_blank" rel="noopener noreferrer">
            {CONFLICT_COPY.openShiprocket} <Icon name="external" size="xs" />
          </a>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          {/* Ready, not Booked: an unknown AWB is most often a parcel booked on Shiprocket but never here. */}
          <Link href={ROUTES.admin.pickups} prefetch={false}>{CONFLICT_COPY.findParcel}</Link>
        </Button>
      )}
      <DismissConflict conflictId={row.id} />
    </div>
  );
}

/** ux.md "admin conflicts": open first, a cancelled parcel's row marked red; rows, a table at `lg:`. */
export function ConflictList({ rows }: { rows: CourierConflictRow[] }) {
  return (
    <ResourceList
      label={CONFLICT_LIST_COPY.courierUpdatesWeCouldn}
      rows={rows}
      rowKey={(row) => row.id}
      tableFrom="lg"
      empty={{ title: CONFLICT_LIST_COPY.noConflicts, description: CONFLICT_COPY.empty }}
      columns={[
        {
          key: "update",
          label: CONFLICT_LIST_COPY.update,
          phone: "title",
          cell: (row) => (
            <span className="block whitespace-normal font-normal">
              <span className="font-medium">{lineOf(row)}</span>
              {meta(row) && <span className="block text-caption text-muted-foreground">{meta(row)}</span>}
              <ConflictDetails payload={row.payload} />
            </span>
          ),
        },
        { key: "awb", label: "AWB", cell: (row) => <span className="font-mono">{row.awb}</span>, phone: "meta" },
        {
          key: "state",
          label: CONFLICT_LIST_COPY.status,
          phone: "status",
          cell: (row) =>
            row.dismissed ? (
              <StatusBadge tone="neutral">{CONFLICT_LIST_COPY.dismissed}</StatusBadge>
            ) : row.kind === COURIER_CONFLICT_KIND.CANCELLED_PARCEL ? (
              <StatusBadge tone="destructive">{CONFLICT_LIST_COPY.cancelledParcel}</StatusBadge>
            ) : (
              <StatusBadge tone="warning">{CONFLICT_LIST_COPY.unknownAwb}</StatusBadge>
            ),
        },
        { key: "actions", label: CONFLICT_LIST_COPY.action, align: "end", phone: "trailing", cell: (row) => <Actions row={row} /> },
      ]}
    />
  );
}
