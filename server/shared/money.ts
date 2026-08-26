/**
 * Money is stored and computed as integer paise (Invariant 3, ADR-0004). These
 * functions are the only sanctioned ×100/÷100 — one for amounts entering as human
 * rupees, one for pre-filling rupee inputs, one for rendering. A `* 100` or `/ 100`
 * anywhere else is a bug.
 *
 * Formatting lives here rather than in `src/lib/format.ts` because emails are
 * rendered on the server and `server/` must not import from `src/`; the client
 * module re-exports this one so there is still a single implementation.
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
export function formatCurrency(paise: number, currency: "INR" = "INR"): string {
  const wholeRupees = paise % 100 === 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: wholeRupees ? 0 : 2,
    maximumFractionDigits: wholeRupees ? 0 : 2,
  }).format(paise / 100);
}
