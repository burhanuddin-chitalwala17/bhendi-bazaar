/**
 * Shared formatting utilities for emails.
 *
 * Money reaches here as integer paise, as it does everywhere past the server boundary
 * (Invariant 3, ADR-0004). `paiseToRupees` is the sanctioned conversion — the client's
 * `src/lib/format.ts` cannot be reused because `server/` does not import from `src/`.
 */

import { paiseToRupees } from "@server/shared/money";

/** 120050 → "₹1,200.50"; whole-rupee amounts drop the decimals: 120000 → "₹1,200". */
export function formatCurrency(paise: number): string {
    const wholeRupees = paise % 100 === 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: wholeRupees ? 0 : 2,
      maximumFractionDigits: wholeRupees ? 0 : 2,
    }).format(paiseToRupees(paise));
  }

  export function formatDate(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }
  
  export function formatShortDate(date: Date): string {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
    }).format(date);
  }