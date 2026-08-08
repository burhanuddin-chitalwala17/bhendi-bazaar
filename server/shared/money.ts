/**
 * Money is stored and computed as integer paise (Invariant 3, ADR-0004). These two
 * functions are the only sanctioned ×100/÷100 — one for amounts entering as human
 * rupees, one for pre-filling rupee inputs. Display formatting lives client-side in
 * `src/lib/format.ts`. Server code never formats money.
 */

/** ₹1,200.50 → 120050. Rounds away float dust (1200.5 * 100 === 120049.999… in IEEE754). */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** 120050 → 1200.5 — for rupee form inputs, not for display. */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}
