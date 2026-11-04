import Link from "next/link";

import type { CancelCountRow } from "@server/payouts/fulfilment-settings.service";
import { FEE_COPY } from "./fee-copy";

/** ux.md "Many items": last 30 days, most cancellations first, 50 a page, "Load more". */
export function CancelCountList({ rows, total, nextHref }: { rows: CancelCountRow[]; total: number; nextHref: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-body font-semibold">{FEE_COPY.countsTitle}</h2>
      {rows.length === 0 ? (
        <p className="text-small text-muted-foreground">{FEE_COPY.noCancels}</p>
      ) : (
        <ul className="divide-y rounded-card border bg-card">
          {rows.map((row) => (
            <li key={row.orgId} className="break-words p-3 text-small">
              {FEE_COPY.countRow(row.shopName, row.count, row.feesPaise)}
            </li>
          ))}
        </ul>
      )}
      {rows.length < total && (
        <Link href={nextHref} scroll={false} className="inline-flex min-h-10 items-center text-small text-primary hover:underline">
          {FEE_COPY.loadMore}
        </Link>
      )}
    </section>
  );
}
