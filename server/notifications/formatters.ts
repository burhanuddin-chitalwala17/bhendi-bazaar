/**
 * Shared formatting utilities for emails
 */

// Not redeclared here. The local copy took paise and formatted them as rupees, so
// every confirmation overstated the order 100×; money has one formatter
// (@server/shared/money) and this domain uses it like everything else.
export { formatCurrency } from "@server/shared/money";

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
