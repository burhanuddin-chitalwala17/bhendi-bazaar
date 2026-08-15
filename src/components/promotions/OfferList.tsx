/**
 * An offer list, shared by both portals.
 *
 * Presentation only — which offers it shows and who may edit them is decided by the
 * page that renders it, because scope belongs to the route, not to a component prop.
 */
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OfferActions } from "@/components/promotions/OfferActions";

export interface OfferRow {
  id: string;
  label: string;
  trigger: "AUTOMATIC" | "CODE";
  code: string | null;
  valueType: "PERCENT" | "AMOUNT_OFF" | "FIXED_PRICE";
  percentBps: number | null;
  amountOffPaise: number | null;
  fixedPricePaise: number | null;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  usageLimit: number | null;
  usageCount: number;
  targets: Array<{ category: { name: string } | null; product: { name: string } | null }>;
}

/** What the offer takes off, in the terms it was written in. */
function value(offer: OfferRow): string {
  if (offer.valueType === "PERCENT") return `${(offer.percentBps ?? 0) / 100}% off`;
  if (offer.valueType === "AMOUNT_OFF") {
    // Same figure, two meanings — say which (promotions D5).
    const amount = formatCurrency(offer.amountOffPaise ?? 0);
    return offer.trigger === "CODE" ? `${amount} off the order` : `${amount} off each item`;
  }
  return `${formatCurrency(offer.fixedPricePaise ?? 0)} each`;
}

/** Zero targets means everything in scope (promotions D3) — said, not left blank. */
function covers(offer: OfferRow): string {
  if (offer.targets.length === 0) return "Everything";
  const names = offer.targets
    .map((target) => target.category?.name ?? target.product?.name)
    .filter((name): name is string => Boolean(name));
  return names.length > 3
    ? `${names.slice(0, 3).join(", ")} +${names.length - 3}`
    : names.join(", ");
}

export function OfferList({
  offers,
  now = new Date(),
  /** Route prefix for this audience — `/admin/promotions` or `/org/<id>/promotions`. */
  basePath,
  /** API prefix for the same, since the two differ. */
  apiPath,
}: {
  offers: OfferRow[];
  now?: Date;
  basePath: string;
  apiPath: string;
}) {
  if (offers.length === 0) {
    return <p className="text-sm text-muted-foreground">No offers yet.</p>;
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {offers.map((offer) => {
        const live = offer.isActive && offer.startsAt <= now && offer.endsAt > now;
        const exhausted = offer.usageLimit !== null && offer.usageCount >= offer.usageLimit;

        return (
          <li key={offer.id}>
            <Card className={`p-4 ${live && !exhausted ? "" : "opacity-70"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-medium">{offer.label}</span>
                {offer.code && (
                  <Badge variant="outline" className="font-mono text-[0.6875rem]">
                    {offer.code}
                  </Badge>
                )}
                {live && !exhausted && (
                  <Badge className="bg-success/15 text-success text-[0.6875rem]">Live</Badge>
                )}
                {!offer.isActive && (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    Stopped
                  </Badge>
                )}
                {exhausted && (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    Fully claimed
                  </Badge>
                )}
                {offer.isActive && offer.endsAt <= now && (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    Ended
                  </Badge>
                )}
                {offer.isActive && offer.startsAt > now && (
                  <Badge variant="outline" className="text-[0.6875rem]">
                    Scheduled
                  </Badge>
                )}
              </div>

              <p className="text-sm">{value(offer)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Covers: {covers(offer)}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                {offer.startsAt.toLocaleDateString("en-IN")} –{" "}
                {/* Markdowns migrated from the old column carry a placeholder end date
                    rather than a deadline anyone chose — say so instead of showing 2099. */}
                {offer.endsAt.getFullYear() > 2090
                  ? "no end date set"
                  : offer.endsAt.toLocaleDateString("en-IN")}
                {offer.usageLimit !== null && ` · ${offer.usageCount}/${offer.usageLimit} used`}
              </p>

              <OfferActions
                editHref={`${basePath}/${offer.id}/edit`}
                stopHref={`${apiPath}/${offer.id}`}
                isActive={offer.isActive}
                label={offer.label}
              />
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
