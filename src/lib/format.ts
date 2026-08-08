/**
 * The one module that knows money is stored as integer paise (Invariant 3,
 * ADR-0004). Amounts enter the system in rupees exactly once (rupeesToPaise, at the
 * server boundary), leave as a string exactly once (formatCurrency), and everything
 * between is integer arithmetic. A `* 100` or `/ 100` anywhere else is a bug.
 */

// Conversions live server-side (dependency direction is inward); re-exported here so
// client code has one import for all things money.
export { rupeesToPaise, paiseToRupees } from "@server/shared/money";

/** 120050 → "₹1,200.50"; whole-rupee amounts drop the decimals: 120000 → "₹1,200". */
export function formatCurrency(paise: number, currency: "INR" = "INR") {
  const wholeRupees = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: wholeRupees ? 0 : 2,
    maximumFractionDigits: wholeRupees ? 0 : 2,
  }).format(paise / 100);
}
