/**
 * Money is stored and computed as integer paise (Invariant 3, ADR-0004). These are the
 * only sanctioned ×100/÷100 — amounts entering as human rupees, pre-filling rupee inputs, and
 * `formatCurrency`, which clients reach through `src/lib/format.ts`. On the server it is used
 * only for a refusal a person reads (offers-hardening R3), never for a stored value.
 */

/** ₹1,200.50 → 120050. Rounds away float dust (1200.5 * 100 === 120049.999… in IEEE754). */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** 120050 → 1200.5 — for rupee form inputs, not for display. */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

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

/** 249950 → "2499.50 INR", the price spelling Google's and Meta's catalogues read; division and remainder, never a float. */
export function feedPrice(paise: number): string {
  const rupees = Math.trunc(paise / 100);
  const rest = paise % 100;
  return `${rupees}.${String(rest).padStart(2, "0")} INR`;
}
