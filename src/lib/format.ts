/**
 * Client-side entry point for money. The implementation lives in
 * `@server/shared/money` — the one module that knows money is stored as integer
 * paise (Invariant 3, ADR-0004) — and is re-exported here so client code has one
 * import for all things money, and so the server (which renders emails) and the
 * browser cannot format the same amount two different ways.
 */

export { rupeesToPaise, paiseToRupees, formatCurrency } from "@server/shared/money";
