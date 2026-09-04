/**
 * Money is stored and computed as integer paise (Invariant 3, ADR-0004). These are
 * the only sanctioned ×100/÷100 — one for amounts entering as human rupees, one for
 * pre-filling rupee inputs, and one for the string a human reads.
 *
 * Formatting used to live client-side on the grounds that "server code never formats
 * money". Transactional email is the counter-example, and the notifications domain
 * met it by declaring a second `formatCurrency` that skipped the ÷100 — so every
 * confirmation quoted the paise as rupees, a ₹1,299 order billed as ₹1,29,900. One
 * declaration, per the no-magic-strings reasoning: a closed rule stated twice drifts.
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
