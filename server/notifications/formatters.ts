/**
 * Shared formatting utilities for emails.
 *
 * Money is deliberately absent: it is formatted by `formatCurrency` in
 * `@server/shared/money`, which is the only thing that knows amounts are paise. A
 * second copy here is what printed ₹99,900 on a ₹999 order.
 */

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

/**
 * Email bodies are built by string interpolation, so every value that originated
 * with a user — a name, an address line, order notes — is escaped on the way in.
 * Unescaped, a `<` in a delivery note is enough to swallow the rest of the bill.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
