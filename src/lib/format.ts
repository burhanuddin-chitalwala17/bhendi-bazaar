/**
 * The one module that knows money is stored as integer paise (Invariant 3,
 * ADR-0004). Amounts enter the system in rupees exactly once (rupeesToPaise, at the
 * server boundary), leave as a string exactly once (formatCurrency), and everything
 * between is integer arithmetic. A `* 100` or `/ 100` anywhere else is a bug.
 */

// All three live server-side (dependency direction is inward, and transactional
// email formats money too); re-exported here so client code has one import for all
// things money.
export { rupeesToPaise, paiseToRupees, formatCurrency } from "@server/shared/money";
