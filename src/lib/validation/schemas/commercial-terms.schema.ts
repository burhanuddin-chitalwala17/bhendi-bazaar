/**
 * What the platform charges one organisation (org-payouts R12, R13).
 *
 * Kept apart from `org.schema.ts` on purpose. That schema is parsed by `/api/orgs`,
 * which any signed-in user may call to create an organisation, and its form is
 * rendered in the organisation's own portal. A commission rate on it would be an
 * organisation setting its own — the plainest kind of mass assignment there is.
 *
 * Rates are typed as percentages because people say "fifteen percent", and converted
 * to basis points at the service seam (ADR-0004).
 */

import { z } from "zod";

const percentRate = z
  .number()
  .min(0, "A rate cannot be negative")
  .max(100, "A rate cannot exceed the whole sale");

export const commercialTermsSchema = z.object({
  /** What the platform takes when no category rule covers an item. */
  commissionPercent: percentRate,
  /** How deep this organisation may discount its own goods (promotions D13a). */
  maxDiscountPercent: percentRate,
  /** Category overrides. Nearest ancestor wins at resolution time (D4b). */
  categoryRates: z
    .array(
      z.object({
        categoryId: z.string().min(1),
        ratePercent: percentRate,
      })
    )
    .max(50)
    .default([]),
});

export type CommercialTermsInput = z.infer<typeof commercialTermsSchema>;
