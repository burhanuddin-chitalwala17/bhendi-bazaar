import Link from "next/link";

import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import {
  brandPageShowing,
  brandPageStanding,
  type BrandPageSectionStatus,
} from "@/components/storefront/brand-page/standing";
import type { BrandPage } from "@/data-access-layer/storefront.dal";

/**
 * What your page shows (brand-page D11).
 *
 * A shop cannot tell a section that is correctly absent from one that is broken, because a
 * page that omits what it has nothing for looks the same either way — which is the price of
 * the rule that there are no empty placeholders (R2). This is where that price is paid back:
 * the same extractors the buyer's page runs, reported to the shop with the one fact each
 * missing section is waiting for.
 *
 * A server component: it reads a payload the page already has and renders it.
 */
export function BrandPageStanding({
  page,
  orgId,
  heading = "What your page shows",
}: {
  page: BrandPage;
  orgId: string;
  heading?: string;
}) {
  const statuses = brandPageStanding(page, orgId);
  const { showing, total } = brandPageShowing(statuses);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{heading}</h2>
        <p className="text-sm text-muted-foreground tabular-nums">
          {showing} of {total} showing
        </p>
      </div>
      <ul className="divide-y divide-border/60 rounded-card border border-border/60">
        {statuses.map((status) => (
          <li key={status.section} className="flex items-start gap-3 p-3">
            <StandingMark status={status} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">{status.label}</p>
              {status.standing === "hidden" && (
                <p className="text-sm text-muted-foreground">
                  You have turned this off, so buyers do not see it.
                </p>
              )}
              {status.standing === "waiting" && status.waitingFor && (
                <p className="text-sm text-muted-foreground">
                  Waiting on {status.waitingFor}.
                  {status.href && (
                    <>
                      {" "}
                      <Link href={status.href} className="font-medium text-primary underline-offset-4 hover:underline">
                        Add it
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Shape as well as colour: the three standings must be distinguishable without it. */
function StandingMark({ status }: { status: BrandPageSectionStatus }) {
  if (status.standing === "showing") {
    return (
      <StatusBadge tone="success" className="mt-0.5">
        <Icon name="done" size="xs" />
        Showing
      </StatusBadge>
    );
  }
  if (status.standing === "hidden") {
    return (
      <StatusBadge tone="neutral" className="mt-0.5">
        <Icon name="hide" size="xs" />
        Hidden
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone="warning" className="mt-0.5">
      <Icon name="time" size="xs" />
      Waiting
    </StatusBadge>
  );
}
