"use client";

/**
 * What the platform charges one organisation.
 *
 * Lives on the payout page rather than in the organisation's profile modal, for two
 * reasons. The profile form is rendered in the organisation's *own* portal and its
 * schema is parsed by an endpoint any signed-in user may call — a rate there would be
 * an organisation setting its own commission. And this is where you are already
 * looking at what that rate produced, which is when you would want to change it.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readApiError } from "@/lib/api-error";

export interface CategoryOption {
  id: string;
  name: string;
}

interface CommercialTermsProps {
  orgId: string;
  commissionBps: number;
  maxDiscountBps: number;
  categories: CategoryOption[];
  current: Array<{ categoryId: string; rateBps: number }>;
}

export function CommercialTerms({
  orgId,
  commissionBps,
  maxDiscountBps,
  categories,
  current,
}: CommercialTermsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [commission, setCommission] = useState(String(commissionBps / 100));
  const [maxDiscount, setMaxDiscount] = useState(String(maxDiscountBps / 100));
  const [rates, setRates] = useState(
    current.map((rule) => ({ categoryId: rule.categoryId, percent: String(rule.rateBps / 100) }))
  );
  const [busy, setBusy] = useState(false);

  const unused = categories.filter((c) => !rates.some((r) => r.categoryId === c.id));
  const nameOf = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const save = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/orgs/${orgId}/commercial-terms`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionPercent: Number(commission),
          maxDiscountPercent: Number(maxDiscount),
          categoryRates: rates
            .filter((rate) => rate.percent !== "")
            .map((rate) => ({ categoryId: rate.categoryId, ratePercent: Number(rate.percent) })),
        }),
      });
      if (!response.ok) throw await readApiError(response);
      toast.success("Commission updated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the commission");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Commission</p>
            <p className="text-xs text-muted-foreground">
              {commissionBps / 100}% by default
              {current.length > 0 && ` · ${current.length} category ${current.length === 1 ? "rate" : "rates"}`}
              {" · "}discounts capped at {maxDiscountBps / 100}%
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Change
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-4">
      <p className="text-sm font-medium">Commission</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="commission" className="text-xs">Default rate (%)</Label>
          <Input
            id="commission"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={commission}
            onChange={(event) => setCommission(event.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Charged where no category rate covers an item.
          </p>
        </div>
        <div>
          <Label htmlFor="maxDiscount" className="text-xs">Their discount ceiling (%)</Label>
          <Input
            id="maxDiscount"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={maxDiscount}
            onChange={(event) => setMaxDiscount(event.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            How deep they may discount their own goods.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Category rates</Label>
        <p className="text-xs text-muted-foreground">
          A rate on a category covers everything beneath it, unless a child sets its own.
        </p>
        {rates.map((rate, index) => (
          <div key={rate.categoryId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm">{nameOf(rate.categoryId)}</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={rate.percent}
              onChange={(event) =>
                setRates((current) =>
                  current.map((r, i) => (i === index ? { ...r, percent: event.target.value } : r))
                )
              }
              className="w-24"
              aria-label={`Rate for ${nameOf(rate.categoryId)}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove the ${nameOf(rate.categoryId)} rate`}
              onClick={() => setRates((c) => c.filter((_, i) => i !== index))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}

        {unused.length > 0 && (
          <select
            value=""
            onChange={(event) =>
              event.target.value &&
              setRates((c) => [...c, { categoryId: event.target.value, percent: "" }])
            }
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            aria-label="Add a category rate"
          >
            <option value="">＋ Add a category rate…</option>
            {unused.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Changing a rate never rewrites a settlement: every rate is snapshotted onto
          the line that used it when the entry was written (R4). */}
      <p className="text-xs text-muted-foreground">
        Applies to orders from now on. Entries already recorded keep the rates they were
        written with.
      </p>

      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save commission"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
