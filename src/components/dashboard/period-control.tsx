import Link from "next/link";

import { cn } from "@/lib/utils";
import type { SalesPeriod } from "@server/analytics/sales.types";
import { PERIOD_OPTIONS } from "./period";

/** The period, as links: the URL holds it, so a view can be shared and the server reads it. */
export function PeriodControl({ current }: { current: SalesPeriod }) {
  return (
    <nav aria-label="Period" className="inline-flex rounded-field border border-border bg-card p-0.5">
      {PERIOD_OPTIONS.map(({ period, label }) => {
        const active = period === current;
        return (
          <Link
            key={period}
            href={`/admin?period=${period}`}
            prefetch={false}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-field px-3 text-small transition-colors duration-fast ease-standard",
              active ? "bg-foreground font-semibold text-background" : "font-medium text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
