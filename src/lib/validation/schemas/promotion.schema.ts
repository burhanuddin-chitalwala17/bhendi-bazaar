/**
 * What an offer form may say (Invariant 4, ADR-0013).
 *
 * One schema, used by the form for inline validation and by the handler for
 * enforcement, so what a user sees cannot drift from what the server accepts.
 *
 * Server-owned fields are absent rather than optional: `usageCount` is the ledger of
 * how many people redeemed a code and belongs to the conditional write that
 * increments it, and `scope`/`orgId` on the organisation's route come from the path,
 * never the body — a body-supplied `orgId` is how one organisation would scope an
 * offer to another's goods.
 */

import { z } from "zod";
import { rupeeAmount, optionalNumber, couponCodeSchema } from "./common.schemas";

export const PROMOTION_VALUE_TYPES = ["PERCENT", "AMOUNT_OFF", "FIXED_PRICE"] as const;
export const PROMOTION_TRIGGERS = ["AUTOMATIC", "CODE"] as const;

/** A percentage as a human types it. Converted to basis points at the service seam. */
const percentSchema = z
  .number()
  .min(0.01, "A discount of nothing is not an offer")
  .max(100, "A discount cannot exceed the price");

export const promotionFormSchema = z
  .object({
    label: z.string().trim().min(3, "Give the offer a name buyers will recognise").max(80),
    trigger: z.enum(PROMOTION_TRIGGERS),
    code: couponCodeSchema.optional(),

    valueType: z.enum(PROMOTION_VALUE_TYPES),
    percent: optionalNumber(percentSchema),
    amountOff: optionalNumber(rupeeAmount("Amount off")),
    fixedPrice: optionalNumber(rupeeAmount("Sale price")),

    maxDiscount: optionalNumber(rupeeAmount("Maximum discount")),
    minSubtotal: optionalNumber(rupeeAmount("Minimum spend")),

    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isActive: z.boolean().default(true),

    usageLimit: optionalNumber(z.number().int().min(1)),
    perUserLimit: optionalNumber(z.number().int().min(1)),

    /** Zero targets means everything in scope (promotions D3). */
    categoryIds: z.array(z.string().min(1)).max(50).default([]),
    productIds: z.array(z.string().min(1)).max(200).default([]),
  })
  .refine((d) => d.endsAt > d.startsAt, {
    message: "The offer must end after it starts",
    path: ["endsAt"],
  })
  .refine((d) => d.trigger !== "CODE" || !!d.code, {
    message: "A coupon needs a code buyers can type",
    path: ["code"],
  })
  .refine((d) => d.trigger !== "AUTOMATIC" || !d.code, {
    message: "An automatic offer applies by itself and takes no code",
    path: ["code"],
  })
  // A product page cannot know the basket, so an offer that sets a displayed price
  // cannot depend on one (promotions D5).
  .refine((d) => d.trigger === "CODE" || (d.minSubtotal === undefined && d.maxDiscount === undefined), {
    message: "Only a coupon can require a minimum spend or cap its discount",
    path: ["minSubtotal"],
  })
  // A flat amount is already its own ceiling. A cap above it does nothing; a cap
  // below it silently makes the offer something other than what it says.
  .refine((d) => d.valueType === "PERCENT" || d.maxDiscount === undefined, {
    message: "Only a percentage needs a cap — a fixed amount is already its own limit",
    path: ["maxDiscount"],
  })
  .refine((d) => d.valueType !== "PERCENT" || d.percent !== undefined, {
    message: "Enter the percentage",
    path: ["percent"],
  })
  .refine((d) => d.valueType !== "AMOUNT_OFF" || d.amountOff !== undefined, {
    message: "Enter the amount to take off",
    path: ["amountOff"],
  })
  .refine((d) => d.valueType !== "FIXED_PRICE" || d.fixedPrice !== undefined, {
    message: "Enter the selling price",
    path: ["fixedPrice"],
  })
  // A fixed selling price is a markdown on one product; applied to a basket it has no
  // meaning, so it must name exactly the products it prices.
  .refine((d) => d.valueType !== "FIXED_PRICE" || d.productIds.length > 0, {
    message: "A fixed selling price has to name the products it applies to",
    path: ["productIds"],
  })
  .refine((d) => d.valueType !== "FIXED_PRICE" || d.trigger === "AUTOMATIC", {
    message: "A fixed selling price is a markdown, not a coupon",
    path: ["valueType"],
  });

export type PromotionFormInput = z.infer<typeof promotionFormSchema>;

/** The fields a platform offer adds — an org's scope comes from its route instead. */
export const platformPromotionSchema = promotionFormSchema;
