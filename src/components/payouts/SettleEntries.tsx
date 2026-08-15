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
import { AlertTriangle, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format";
import { readApiError } from "@/lib/api-error";

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
  settlementStatus: "PENDING" | "PAID" | "CANCELLED" | null;
}

export function SettleEntries({ orgId, entries }: { orgId: string; entries: LedgerEntryRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Only entries nothing has claimed yet can go into a new settlement.
  const claimable = entries.filter(
    (entry) => entry.deletedAt === null && entry.settlementStatus === null
  );
  const selectedTotal = claimable
    .filter((entry) => selected.includes(entry.id))
    .reduce((sum, entry) => sum + entry.payablePaise, 0);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    );

  const settle = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, entryIds: selected }),
      });
      if (!response.ok) throw await readApiError(response);
      toast.success(`Settlement created for ${formatCurrency(selectedTotal)}`);
      setSelected([]);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the settlement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Entries</h2>
        {claimable.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setSelected(
                selected.length === claimable.length ? [] : claimable.map((entry) => entry.id)
              )
            }
          >
            {selected.length === claimable.length ? "Clear selection" : "Select all unclaimed"}
          </Button>
        )}
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
      )}

      <ul className="space-y-3">
        {entries.map((entry) => {
          const selectable = entry.deletedAt === null && entry.settlementStatus === null;
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
                      aria-label={`Include ${entry.orderId ?? "adjustment"} in a settlement`}
                    />
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.orderId ?? "manual adjustment"}
                  </span>
                  {entry.settlementStatus && (
                    <Badge variant="outline" className="text-[0.6875rem]">
                      {entry.settlementStatus.toLowerCase()}
                    </Badge>
                  )}
                  {entry.isManuallyEdited && (
                    <Badge variant="outline" className="gap-1 text-[0.6875rem]">
                      <PencilLine className="size-3" aria-hidden /> edited
                    </Badge>
                  )}
                  {entry.deletedAt && (
                    <Badge variant="outline" className="text-[0.6875rem]">removed</Badge>
                  )}
                  {entry.isNegativeMargin && (
                    <Badge className="gap-1 bg-warning/15 text-warning text-[0.6875rem]">
                      <AlertTriangle className="size-3" aria-hidden /> below cost
                    </Badge>
                  )}
                </div>

                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Buyer paid</dt>
                    <dd className="tabular-nums">{formatCurrency(entry.buyerPaidPaise)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Payable</dt>
                    <dd className="tabular-nums text-primary">
                      −{formatCurrency(entry.payablePaise)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-medium">
                    <dt>Platform net</dt>
                    <dd className="tabular-nums">{formatCurrency(entry.platformNetPaise)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 pt-1 text-xs text-muted-foreground">
                    <dt>Commission</dt>
                    <dd className="tabular-nums">{formatCurrency(entry.commissionPaise)}</dd>
                  </div>
                  {entry.campaignCostPaise > 0 && (
                    <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                      <dt>Campaign cost</dt>
                      <dd className="tabular-nums">−{formatCurrency(entry.campaignCostPaise)}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            </li>
          );
        })}
      </ul>

      {/* Docked above the tab bar so the action stays reachable while scrolling a long
          ledger — the selection is meaningless if you have to scroll back to use it. */}
      {selected.length > 0 && (
        <div className="sticky bottom-tabbar z-10 -mx-4 border-t border-border bg-background/95 p-4 backdrop-blur md:mx-0 md:rounded-lg md:border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{formatCurrency(selectedTotal)}</span>
              <span className="text-muted-foreground">
                {" "}across {selected.length} {selected.length === 1 ? "entry" : "entries"}
              </span>
            </p>
            <Button onClick={settle} disabled={isSaving}>
              {isSaving ? "Creating…" : "Create settlement"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
