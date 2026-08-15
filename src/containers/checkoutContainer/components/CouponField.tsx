"use client";

/**
 * Where a buyer enters a coupon.
 *
 * At checkout rather than in the cart, because a coupon's minimum spend is measured
 * on the items it covers and the basket is still moving in the cart — a code accepted
 * and then silently invalidated by a quantity change is worse than one entered once,
 * here, against a basket that is settled (promotions R11).
 */

import { useState } from "react";
import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { OfferQuote } from "../hooks/useCheckoutOffers";

interface CouponFieldProps {
  quote: OfferQuote;
  appliedCode: string | null;
  isPricing: boolean;
  onApply: (code: string) => Promise<OfferQuote>;
  onClear: () => void;
  /** How many basket lines exist, so coverage can be stated as "2 of 3". */
  lineCount: number;
}

export function CouponField({
  quote,
  appliedCode,
  isPricing,
  onApply,
  onClear,
  lineCount,
}: CouponFieldProps) {
  const [typed, setTyped] = useState("");

  const applied = appliedCode
    ? quote.applied.find((offer) => offer.code === appliedCode)
    : undefined;
  const covered = quote.couponCoveredKeys.length;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!typed.trim()) return;
    const result = await onApply(typed.trim());
    if (result.rejection === null) setTyped("");
  };

  if (applied) {
    return (
      <div className="rounded-xl border border-success/40 bg-success/5 p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium">
              <Tag className="size-4 shrink-0 text-success" aria-hidden />
              <span className="truncate font-mono text-xs">{appliedCode}</span>
              <span className="text-success">−{formatCurrency(applied.amountPaise)}</span>
            </p>
            {/* Coverage from data, not from a rule the browser re-derives. Saying it
                here is what stops "why was it only ₹100 off" reaching support. */}
            {covered > 0 && covered < lineCount && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Covers {covered} of {lineCount} items
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label={`Remove coupon ${appliedCode}`}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Coupon code"
          // Codes are typed from a poster or a message; neither wants autocorrect.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Coupon code"
          className="uppercase"
        />
        <Button type="submit" variant="outline" disabled={!typed.trim() || isPricing}>
          {isPricing ? "Checking…" : "Apply"}
        </Button>
      </div>

      {/* A refused code says why, and what would fix it where that is knowable. */}
      {quote.rejection && (
        <p className="text-xs text-destructive">
          {quote.rejection.message}
          {quote.rejection.shortfallPaise !== undefined &&
            ` Add ${formatCurrency(quote.rejection.shortfallPaise)} more of the items it covers.`}
        </p>
      )}
    </form>
  );
}
