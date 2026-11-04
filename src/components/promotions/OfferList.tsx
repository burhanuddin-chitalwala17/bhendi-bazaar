"use client";

/**
 * The offers table, shared by both portals: rows on a phone, a table from a tablet (ResourceList).
 *
 * Presentation only — which offers it shows and who may edit them is decided by the page that
 * renders it, because scope belongs to the route, not to a component prop.
 */
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { ResourceList, type ResourceColumn } from "@/components/shared/resource-list";
import type { EmptyStateProps } from "@/components/shared/states/EmptyState";
import { OfferActions } from "@/components/promotions/OfferActions";
import { bpsToPercent, formatCurrency, formatShortDate } from "@/lib/format";
import type { OfferListRow } from "@server/promotions/promotion.types";

/** @deprecated name kept for existing imports; the shape is the domain's `OfferListRow`. */
export type OfferRow = OfferListRow;

/** What the offer takes off, in the terms it was written in. */
function value(offer: OfferRow): string {
  if (offer.valueType === "PERCENT") return `${bpsToPercent(offer.percentBps ?? 0)}% off`;
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
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3}` : names.join(", ");
}

/** Markdowns migrated from the old column carry a placeholder end, not a deadline anyone chose. */
const runs = (offer: OfferRow) =>
  `${formatShortDate(offer.startsAt)} – ${offer.endsAt.getFullYear() > 2090 ? "no end date" : formatShortDate(offer.endsAt)}`;

/** The one status a row shows: stopped, then the dates, then whether a running offer is used up. */
function status(offer: OfferRow, now: Date): ReactNode {
  if (!offer.isActive) return <StatusBadge tone="neutral">Stopped</StatusBadge>;
  if (offer.endsAt <= now) return <StatusBadge tone="neutral">Ended</StatusBadge>;
  if (offer.startsAt > now) return <StatusBadge tone="info">Scheduled</StatusBadge>;
  if (offer.platformBudgetPaise !== null && offer.platformSpentPaise >= offer.platformBudgetPaise)
    return <StatusBadge tone="warning">Budget used up</StatusBadge>;
  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit)
    return <StatusBadge tone="neutral">Fully claimed</StatusBadge>;
  return <StatusBadge tone="success">Live</StatusBadge>;
}

function usage(offer: OfferRow): ReactNode {
  const parts = [
    offer.usageLimit !== null ? `${offer.usageCount}/${offer.usageLimit} used` : `${offer.usageCount} used`,
    offer.platformBudgetPaise !== null
      ? `${formatCurrency(offer.platformSpentPaise)} of ${formatCurrency(offer.platformBudgetPaise)} used`
      : null,
  ].filter(Boolean);
  return (
    <span className="tabular-nums">
      {parts.join(" · ")}
      {offer.lossConfirmedAt && (
        <span className="block text-caption text-warning">
          Runs at a loss — confirmed by {offer.lossConfirmedBy?.name ?? "an admin"}, {formatShortDate(offer.lossConfirmedAt)}
        </span>
      )}
    </span>
  );
}

export function OfferList({
  offers,
  now,
  /** Route prefix for this audience — `/admin/promotions` or `/org/<id>/promotions`. */
  basePath,
  /** API prefix for the same, since the two differ. */
  apiPath,
  empty,
  footer,
}: {
  offers: OfferRow[];
  /** The server's clock, so a row's status cannot differ between the server render and the browser's. */
  now?: Date;
  basePath: string;
  apiPath: string;
  empty?: Pick<EmptyStateProps, "title" | "description" | "action">;
  footer?: ReactNode;
}) {
  const at = now ?? new Date();
  const columns: ResourceColumn<OfferRow>[] = [
    {
      key: "label",
      label: "Offer",
      sortable: true,
      phone: "title",
      cell: (o) => (
        <span className="inline-flex max-w-md items-center gap-2">
          <span className="truncate">{o.label}</span>
          {o.code && (
            <Badge variant="outline" className="font-mono text-2xs">
              {o.code}
            </Badge>
          )}
        </span>
      ),
    },
    { key: "value", label: "Discount", phone: "meta", cell: value },
    {
      key: "covers",
      label: "Covers",
      phone: "hidden",
      cell: (o) => <span className="block max-w-xs truncate text-muted-foreground">{covers(o)}</span>,
    },
    { key: "endsAt", label: "Runs", sortable: true, phone: "meta", cell: (o) => <span className="tabular-nums">{runs(o)}</span> },
    { key: "usage", label: "Used", phone: "hidden", cell: usage },
    { key: "status", label: "Status", phone: "status", cell: (o) => status(o, at) },
    {
      key: "actions",
      label: "Actions",
      phone: "trailing",
      align: "end",
      cell: (o) => (
        <OfferActions
          editHref={`${basePath}/${o.id}/edit`}
          stopHref={`${apiPath}/${o.id}`}
          isActive={o.isActive && o.endsAt > at}
          label={o.label}
        />
      ),
    },
  ];

  return (
    <ResourceList
      label="Offers"
      rows={offers}
      rowKey={(o) => o.id}
      columns={columns}
      rowHref={(o) => `${basePath}/${o.id}/edit`}
      empty={empty ?? { title: "No offers yet", description: "An offer you create shows here." }}
      footer={footer}
    />
  );
}
