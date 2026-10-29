/**
 * The words and the floor a shop's discount ceiling is refused with (offers-hardening R3, Q7).
 *
 * The engine clamps whatever is already running; these refuse at the form what can be known
 * there. Both measure against `applyBps`, so the form and the clamp agree to the paise.
 */

import { applyBps } from "@server/promotions/allocation";
import { formatCurrency } from "@server/shared/money";

const percent = (bps: number) => `${bps / 100}%`;

/** The lowest sale price a shop with this ceiling may set on this price. */
export function saleFloorPaise(pricePaise: number, ceilingBps: number): number {
  return pricePaise - applyBps(pricePaise, ceilingBps);
}

/** Why `amountOffPaise` off `pricePaise` breaches the ceiling, or null when it does not. */
export function offerCeilingBreach(pricePaise: number, amountOffPaise: number, ceilingBps: number): string | null {
  if (amountOffPaise <= applyBps(pricePaise, ceilingBps)) return null;
  // Rounded up, so a breach never reads as equal to the cap.
  const depthBps = Math.ceil((amountOffPaise * 10_000) / pricePaise);
  return (
    `Your shop's offers can take off at most ${percent(ceilingBps)}. ` +
    `${formatCurrency(amountOffPaise)} off ${formatCurrency(pricePaise)} is ${percent(depthBps)}.`
  );
}

/** Why a sale price below the floor is refused, or null when it is within the ceiling. */
export function saleFloorBreach(pricePaise: number, salePricePaise: number, ceilingBps: number): string | null {
  const floor = saleFloorPaise(pricePaise, ceilingBps);
  if (salePricePaise >= floor) return null;
  return `Your sale price can be at most ${percent(ceilingBps)} below the price — no lower than ${formatCurrency(floor)}.`;
}
