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
import { CONFIRM_LOSS_ERROR, CONFIRM_LOSS_PHRASE } from "@server/promotions/loss";
import { OFFER_KIND, OFFER_SORTS, OFFER_STATUS, type OfferListQuery } from "@server/promotions/promotion.types";

export const PROMOTION_VALUE_TYPES = ["PERCENT", "AMOUNT_OFF", "FIXED_PRICE"] as const;
export const PROMOTION_TRIGGERS = ["AUTOMATIC", "CODE"] as const;

/** A percentage as a human types it. Converted to basis points at the service seam. */
const percentSchema = z
  .number()
  .min(0.01, "A discount of nothing is not an offer")
  .max(100, "A discount cannot exceed the price");

const offerFields = z.object({
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
});

type OfferFields = z.infer<typeof offerFields>;

/** The cross-field rules every offer obeys, whichever audience's form it came from. */
const OFFER_RULES: Array<{ holds: (d: OfferFields) => boolean; message: string; path: keyof OfferFields }> = [
  { holds: (d) => d.endsAt > d.startsAt, message: "The offer must end after it starts", path: "endsAt" },
  { holds: (d) => d.trigger !== "CODE" || !!d.code, message: "A coupon needs a code buyers can type", path: "code" },
  {
    holds: (d) => d.trigger !== "AUTOMATIC" || !d.code,
    message: "An automatic offer applies by itself and takes no code",
    path: "code",
  },
  // A product page cannot know the basket, so an offer that sets a displayed price
  // cannot depend on one (promotions D5).
  {
    holds: (d) => d.trigger === "CODE" || (d.minSubtotal === undefined && d.maxDiscount === undefined),
    message: "Only a coupon can require a minimum spend or cap its discount",
    path: "minSubtotal",
  },
  // A flat amount is already its own ceiling. A cap above it does nothing; a cap
  // below it silently makes the offer something other than what it says.
  {
    holds: (d) => d.valueType === "PERCENT" || d.maxDiscount === undefined,
    message: "Only a percentage needs a cap — a fixed amount is already its own limit",
    path: "maxDiscount",
  },
  { holds: (d) => d.valueType !== "PERCENT" || d.percent !== undefined, message: "Enter the percentage", path: "percent" },
  {
    holds: (d) => d.valueType !== "AMOUNT_OFF" || d.amountOff !== undefined,
    message: "Enter the amount to take off",
    path: "amountOff",
  },
  {
    holds: (d) => d.valueType !== "FIXED_PRICE" || d.fixedPrice !== undefined,
    message: "Enter the selling price",
    path: "fixedPrice",
  },
  // A fixed selling price is a markdown on one product; applied to a basket it has no
  // meaning, so it must name exactly the products it prices.
  {
    holds: (d) => d.valueType !== "FIXED_PRICE" || d.productIds.length > 0,
    message: "A fixed selling price has to name the products it applies to",
    path: "productIds",
  },
  {
    holds: (d) => d.valueType !== "FIXED_PRICE" || d.trigger === "AUTOMATIC",
    message: "A fixed selling price is a markdown, not a coupon",
    path: "valueType",
  },
];

const offerRules = (d: OfferFields, ctx: z.RefinementCtx) => {
  for (const rule of OFFER_RULES) {
    if (!rule.holds(d)) ctx.addIssue({ code: "custom", message: rule.message, path: [rule.path] });
  }
};

/**
 * A shop's form adds one choice: whether its code is printed on its own storefront (storefront-themes
 * Q20). Off unless ticked, since a public code is used by strangers; a platform offer has no shop page.
 */
export const promotionFormSchema = offerFields
  .extend({ showOnStorefront: z.boolean().default(false) })
  .superRefine(offerRules);

export type PromotionFormInput = z.infer<typeof promotionFormSchema>;

/**
 * The fields a platform offer adds (offers-hardening D6). Whether the confirmation and the budget
 * are *required* depends on the lowest commission rate, which only the server knows, so the
 * service enforces that; this refuses what is wrong whatever the rate. The spend and who confirmed
 * are server-owned and absent (Invariant 4).
 */
export const platformPromotionSchema = offerFields
  .extend({
    budget: optionalNumber(rupeeAmount("Budget")),
    confirmLoss: z
      .string()
      .trim()
      .refine((v) => v === "" || v === CONFIRM_LOSS_PHRASE, CONFIRM_LOSS_ERROR)
      .optional(),
  })
  .superRefine(offerRules);

export type PlatformPromotionFormInput = z.infer<typeof platformPromotionSchema>;

/** A search parameter's first value: `?a=1&a=2` arrives as an array. */
const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);

/**
 * The offers list's URL (offers list Q1). It is hand-typeable, so an unknown value falls back to
 * the default rather than erroring; the sort column is resolved against a closed set before it
 * can reach `orderBy`.
 */
export const offerListQuerySchema = z.object({
  status: z.preprocess(first, z.enum(OFFER_STATUS).catch(OFFER_STATUS.ALL)),
  kind: z.preprocess(first, z.enum(OFFER_KIND).catch(OFFER_KIND.ALL)),
  search: z.preprocess(first, z.string().trim().max(100).catch("")).default(""),
  sortBy: z.preprocess(first, z.enum(OFFER_SORTS).catch("createdAt")),
  sortOrder: z.preprocess(first, z.enum(["asc", "desc"]).catch("desc")),
  page: z.preprocess(first, z.coerce.number().int().positive().max(10_000).catch(1)),
}) satisfies z.ZodType<OfferListQuery, unknown>;
