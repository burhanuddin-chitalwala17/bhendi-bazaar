"use client";

/**
 * Settlements, and the one place a payment is recorded.
 *
 * `PAID` is terminal (org-payouts D8): it records a transfer that actually happened,
 * so its amount and reference are fixed afterwards and a correction is a new ledger
 * entry. Cancelling releases the entries back to unsettled, intact.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/format";
import { readApiError } from "@/lib/api-error";

export interface SettlementRow {
  id: string;
  code: string;
  amountPaise: number;
  status: "PENDING" | "PAID" | "CANCELLED";
  reference: string | null;
  paidAt: Date | null;
}

export function SettlementList({ settlements }: { settlements: SettlementRow[] }) {
  const router = useRouter();
  const [recording, setRecording] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (id: string, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/settlements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw await readApiError(response);
      toast.success(done);
      setRecording(null);
      setReference("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the settlement");
    } finally {
      setBusy(false);
    }
  };

  if (settlements.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Settlements</h2>
      <ul className="space-y-2">
        {settlements.map((settlement) => (
          <li key={settlement.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <span className="font-mono text-xs">{settlement.code}</span>
                  <Badge
                    variant="outline"
                    className={`text-2xs ${
                      settlement.status === "PAID" ? "border-success text-success" : ""
                    }`}
                  >
                    {settlement.status.toLowerCase()}
                  </Badge>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {settlement.status === "PAID" && settlement.paidAt
                    ? `Paid ${new Date(settlement.paidAt).toLocaleDateString("en-IN")}`
                    : "Not yet transferred"}
                  {settlement.reference ? ` · ${settlement.reference}` : ""}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(settlement.amountPaise)}
              </span>
            </div>

            {settlement.status === "PENDING" && recording !== settlement.id && (
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                <Button size="sm" onClick={() => setRecording(settlement.id)}>
                  Mark as paid
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => send(settlement.id, { status: "CANCELLED" }, "Settlement cancelled")}
                >
                  Cancel
                </Button>
              </div>
            )}

            {recording === settlement.id && (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <div>
                  <Label htmlFor={`ref-${settlement.id}`} className="text-xs">
                    Bank reference
                  </Label>
                  <Input
                    id={`ref-${settlement.id}`}
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="UTR or cheque number"
                    className="mt-1"
                  />
                  {/* The reference is what makes the ledger checkable against a bank
                      statement, which is the whole point of recording the transfer. */}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recorded against {formatCurrency(settlement.amountPaise)}. Once saved, the
                    amount and reference are fixed — a correction is a new entry.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      send(
                        settlement.id,
                        { status: "PAID", reference: reference.trim() || undefined },
                        `${settlement.code} recorded as paid`
                      )
                    }
                  >
                    {busy ? "Saving…" : "Confirm payment"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRecording(null)}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
