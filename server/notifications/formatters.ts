/**
 * Shared formatting utilities for emails.
 *
 * The documented exception to "server code never formats money" (`server/shared/money.ts`):
 * an email has no client to format it.
 */

import { paiseToRupees } from "@server/shared/money";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** What every template actually wants — integer paise straight to "₹1,200". */
export function formatPaise(paise: number): string {
  return formatCurrency(paiseToRupees(paise));
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
