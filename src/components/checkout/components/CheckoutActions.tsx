"use client";

import { Button } from "@/components/ui/button";
import { ActionBar } from "@/components/shared/action-bar";
import { formatCurrency } from "@/lib/format";
import { CHECKOUT_COPY } from "../checkout-copy";

interface CheckoutActionsProps {
  isProcessing: boolean;
  /** Paise, as the server will price it; the server recomputes before charging (Invariant 1). */
  total: number;
  onPay: () => void;
}

/**
 * The one Pay button (design-system Q27): it opens Razorpay, which offers UPI, card, net banking
 * and wallets. Never disabled (ADR-0053): a tap with something missing names it beside its step.
 */
export function CheckoutActions({ isProcessing, total, onPay }: CheckoutActionsProps) {
  return (
    <ActionBar
      dock="edge"
      className="-mx-3 sm:-mx-6 md:mx-0"
      status={
        <span className="flex flex-col md:hidden">
          <span className="text-title font-semibold tabular-nums text-foreground">{formatCurrency(total)}</span>
          <span>{CHECKOUT_COPY.inclDeliveryTaxes}</span>
        </span>
      }
    >
      <Button size="lg" className="rounded-full px-8 md:w-full" pending={isProcessing} onClick={onPay}>
        {CHECKOUT_COPY.payAmount(formatCurrency(total))}
      </Button>
    </ActionBar>
  );
}
