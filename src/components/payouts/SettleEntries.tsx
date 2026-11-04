"use client";

/**
 * Choosing what to pay, and recording that it was paid.
 *
 * Settlement is free-form (org-payouts D7): the platform picks whatever is unsettled,
 * whenever it suits. So this is a selection over the unclaimed entries rather than a
 * period the system decides.
 *
 * Nothing here marks itself paid (spec R21) — recording a payment is a deliberate act
 * with a reference, because the figure has to be checkable against a bank statement.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { SelectionBar } from "@/components/shared/selection-bar";
import { SETTLEMENT_STATUS_BADGE, type SettlementStatus } from "@/components/payouts/settlement-status";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format";
import { useMutation } from "@/hooks/core/useMutation";
import { payoutsApiClient } from "@/components/payouts/payoutsApiClient";
import { Money } from "@/components/shared/Money";
import { SETTLE_ENTRIES_COPY } from "./payouts-copy";

export interface LedgerEntryRow {
  id: string;
  orderId: string | null;
  buyerPaidPaise: number;
  payablePaise: number;
  commissionPaise: number;
  campaignCostPaise: number;
  platformNetPaise: number;
  isNegativeMargin: boolean;
  isManuallyEdited: boolean;
  deletedAt: Date | null;
  settlementStatus: SettlementStatus | null;
}

export function SettleEntries({
  orgId,
  entries,
}: {
  orgId: string;
  entries: LedgerEntryRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  // Only entries nothing has claimed yet can go into a new settlement.
  const claimable = entries.filter(
    (entry) => entry.deletedAt === null && entry.settlementStatus === null,
  );
  const selectedTotal = claimable
    .filter((entry) => selected.includes(entry.id))
    .reduce((sum, entry) => sum + entry.payablePaise, 0);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const { mutate, isLoading: isSaving } = useMutation(
    () => payoutsApiClient.createSettlement(orgId, selected),
    {
      successMessage: SETTLE_ENTRIES_COPY.created(formatCurrency(selectedTotal)),
      onSuccess: () => {
        setSelected([]);
        router.refresh();
      },
    },
  );

  // The toast is the whole report; the rejection has nowhere further to go.
  const settle = () => mutate().catch(() => {});

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-small font-semibold">{SETTLE_ENTRIES_COPY.title}</h2>
        {claimable.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(
                selected.length === claimable.length
                  ? []
                  : claimable.map((entry) => entry.id),
              )
            }
          >
            {selected.length === claimable.length
              ? SETTLE_ENTRIES_COPY.clearSelection
              : SETTLE_ENTRIES_COPY.selectUnclaimed}
          </Button>
        )}
      </div>

      {entries.length === 0 && (
        <p className="text-small text-muted-foreground">{SETTLE_ENTRIES_COPY.nothing}</p>
      )}

      <ul className="space-y-3">
        {entries.map((entry) => {
          const selectable =
            entry.deletedAt === null && entry.settlementStatus === null;
          return (
            <li key={entry.id}>
              <Card
                className={`p-4 ${entry.deletedAt ? "opacity-60" : ""} ${
                  entry.isNegativeMargin ? "border-warning/50" : ""
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {selectable && (
                    <Checkbox
                      label=""
                      checked={selected.includes(entry.id)}
                      onChange={() => toggle(entry.id)}
                      aria-label={SETTLE_ENTRIES_COPY.include(entry.orderId)}
                    />
                  )}
                  <span className="font-mono text-caption text-muted-foreground">
                    {entry.orderId ?? SETTLE_ENTRIES_COPY.manualAdjustment}
                  </span>
                  {entry.settlementStatus && (
                    <StatusBadge tone={SETTLEMENT_STATUS_BADGE[entry.settlementStatus].tone}>
                      {SETTLEMENT_STATUS_BADGE[entry.settlementStatus].label}
                    </StatusBadge>
                  )}
                  {entry.isManuallyEdited && (
                    <StatusBadge>
                      <Icon name="edit" size="xs" /> {SETTLE_ENTRIES_COPY.edited}
                    </StatusBadge>
                  )}
                  {entry.deletedAt && <StatusBadge>{SETTLE_ENTRIES_COPY.removed}</StatusBadge>}
                  {entry.isNegativeMargin && (
                    <StatusBadge tone="warning">
                      <Icon name="warning" size="xs" /> {SETTLE_ENTRIES_COPY.belowCost}
                    </StatusBadge>
                  )}
                </div>

                <dl className="space-y-1.5 text-small">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{SETTLE_ENTRIES_COPY.buyerPaid}</dt>
                    <dd className="tabular-nums">
                      <Money paise={entry.buyerPaidPaise} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{SETTLE_ENTRIES_COPY.payable}</dt>
                    <dd className="tabular-nums text-primary">
                      −<Money paise={entry.payablePaise} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-medium">
                    <dt>{SETTLE_ENTRIES_COPY.platformNet}</dt>
                    <dd className="tabular-nums">
                      <Money paise={entry.platformNetPaise} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 pt-1 text-caption text-muted-foreground">
                    <dt>{SETTLE_ENTRIES_COPY.commission}</dt>
                    <dd className="tabular-nums">
                      {formatCurrency(entry.commissionPaise)}
                    </dd>
                  </div>
                  {entry.campaignCostPaise > 0 && (
                    <div className="flex justify-between gap-4 text-caption text-muted-foreground">
                      <dt>{SETTLE_ENTRIES_COPY.campaignCost}</dt>
                      <dd className="tabular-nums">
                        −{formatCurrency(entry.campaignCostPaise)}
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            </li>
          );
        })}
      </ul>

      <SelectionBar
        count={selected.length}
        noun={SETTLE_ENTRIES_COPY.noun(selected.length, formatCurrency(selectedTotal))}
        onClear={() => setSelected([])}
        actions={[{ label: SETTLE_ENTRIES_COPY.create, onClick: settle, pending: isSaving }]}
      />
    </section>
  );
}

