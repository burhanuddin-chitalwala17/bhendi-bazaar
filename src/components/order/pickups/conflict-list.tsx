import Link from "next/link";
import { ExternalLink } from "lucide-react";

import type { CourierConflictRow } from "@server/shipping/courier-conflict.service";
import { COURIER_CONFLICT_KIND } from "@server/shipping/domain/shipping.types";
import { indiaMoment } from "@server/shared/india-time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConflictDetails, DismissConflict } from "./conflict-actions";
import { CONFLICT_COPY, SHIPROCKET_URL } from "./pickups-copy";

function lineOf(row: CourierConflictRow): string {
  return row.kind === COURIER_CONFLICT_KIND.CANCELLED_PARCEL
    ? CONFLICT_COPY.cancelledParcel(row.parcelCode ?? row.awb, row.courierWording)
    : CONFLICT_COPY.unknownAwb(row.awb, indiaMoment(new Date(row.receivedAt)));
}

function Actions({ row }: { row: CourierConflictRow }) {
  if (row.dismissed) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {row.kind === COURIER_CONFLICT_KIND.CANCELLED_PARCEL ? (
        <Button asChild size="sm" variant="outline" className="min-h-10">
          <a href={SHIPROCKET_URL} target="_blank" rel="noopener noreferrer">
            {CONFLICT_COPY.openShiprocket} <ExternalLink className="ml-1 size-3" />
          </a>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="min-h-10">
          {/* Ready, not Booked: an unknown AWB is most often a parcel booked on Shiprocket but never here. */}
          <Link href="/admin/orders/pickups">{CONFLICT_COPY.findParcel}</Link>
        </Button>
      )}
      <DismissConflict conflictId={row.id} />
    </div>
  );
}

/** ux.md "admin conflicts": open first, a cancelled parcel's row in red; cards, a table at `lg:`. */
export function ConflictList({ rows }: { rows: CourierConflictRow[] }) {
  const tone = (row: CourierConflictRow) =>
    cn(row.dismissed && "opacity-60", !row.dismissed && row.kind === COURIER_CONFLICT_KIND.CANCELLED_PARCEL && "border-destructive text-destructive");
  const meta = (row: CourierConflictRow) =>
    [row.updates > 1 ? CONFLICT_COPY.updates(row.updates) : null, row.dismissed ? CONFLICT_COPY.dismissedBy(row.dismissedByName ?? "staff") : null]
      .filter(Boolean)
      .join(" · ");

  return (
    <>
      <ul className="grid grid-cols-1 gap-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className={cn("flex flex-col gap-2 rounded-card border bg-card p-4 text-sm", tone(row))}>
            <p className="break-words">{lineOf(row)}</p>
            {meta(row) && <p className="text-muted-foreground">{meta(row)}</p>}
            <ConflictDetails payload={row.payload} />
            <Actions row={row} />
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Update</th>
            <th className="py-2">AWB</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className={tone(row)}>
              <td className="max-w-md break-words py-2 align-top">
                <p>{lineOf(row)}</p>
                {meta(row) && <p className="text-muted-foreground">{meta(row)}</p>}
                <ConflictDetails payload={row.payload} />
              </td>
              <td className="py-2 align-top">{row.awb}</td>
              <td className="py-2 text-right align-top">
                <Actions row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
