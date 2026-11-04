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
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { OfferQuote } from "../hooks/useCheckoutOffers";
import { COUPON_COPY } from "../checkout-copy";

interface CouponFieldProps {
  quote: OfferQuote;
  appliedCode: string | null;
  isPricing: boolean;
  onApply(code: string): Promise<OfferQuote>;
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
      <div className="rounded-card border border-success/40 bg-success/5 p-3 text-small">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium">
              <Icon name="offer" size="sm" tone="success" />
              <span className="truncate font-mono text-caption">{appliedCode}</span>
              <span className="text-success">
                −{formatCurrency(applied.amountPaise)}
              </span>
            </p>
            {/* Coverage from data, not from a rule the browser re-derives. Saying it
                here is what stops "why was it only ₹100 off" reaching support. */}
            {covered > 0 && covered < lineCount && (
              <p className="mt-0.5 text-caption text-muted-foreground">
                {COUPON_COPY.covers(covered, lineCount)}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            aria-label={COUPON_COPY.remove(appliedCode)}
          >
            <Icon name="close" size="sm" />
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
          placeholder={COUPON_COPY.placeholder}
          // Codes are typed from a poster or a message; neither wants autocorrect.
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label={COUPON_COPY.placeholder}
          className="uppercase"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!typed.trim() || isPricing}
        >
          {isPricing ? COUPON_COPY.checking : COUPON_COPY.apply}
        </Button>
      </div>

      {/* A refused code says why, and what would fix it where that is knowable. */}
      {quote.rejection && (
        <p className="text-caption text-destructive">
          {quote.rejection.message}
          {quote.rejection.shortfallPaise !== undefined &&
            COUPON_COPY.shortfall(formatCurrency(quote.rejection.shortfallPaise))}
        </p>
      )}
    </form>
  );
}
