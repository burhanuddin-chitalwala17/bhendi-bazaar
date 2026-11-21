import { z } from "zod";
import { PaymentMethod } from "@prisma/client";
import { isOwnObjectUrl } from "@server/catalog/object-store";
import { MAX_MARGIN_BPS, MAX_TOP_UP_PAISE } from "@server/payouts/credit.types";

/**
 * Shop credit and payment proof (ai-images/shop-credits D6–D9). Parsed, never cast (Invariant 4).
 * An amount here is money the admin saw arrive outside the platform, not a price the client chose:
 * nothing is charged from it (Invariant 1 concerns what the platform charges).
 */

/** A picture we stored — a receipt or a QR code is never a link to somewhere else. */
const ownImage = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((url) => isOwnObjectUrl(url), { message: "Upload the picture here rather than linking to it" });

const today = () => {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

/** Proof that money moved (D6), shared by a top-up and a paid settlement. */
export const paymentProofSchema = z.object({
  method: z.enum(PaymentMethod),
  reference: z.string().trim().min(1, "Add the transaction reference").max(120),
  paidOn: z.coerce.date().refine((date) => date <= today(), { message: "The payment date cannot be in the future" }),
  receiptRef: ownImage.nullable().optional().transform((value) => value ?? null),
});

export const topUpSchema = paymentProofSchema.extend({
  amountPaise: z
    .number()
    .int("Whole paise only")
    .min(1, "Enter an amount above zero")
    .max(MAX_TOP_UP_PAISE, "That is more than ₹10,00,000 — check the amount"),
});
export type TopUpInput = z.infer<typeof topUpSchema>;

export const reverseCreditSchema = z.object({
  reason: z.string().trim().min(3, "Say why, so the shop and the next admin can read it").max(300),
});

export const marginSchema = z.object({
  marginBps: z.number().int().min(0).max(MAX_MARGIN_BPS).nullable(),
});

export const platformMarginSchema = z.object({
  marginBps: z.number().int().min(0).max(MAX_MARGIN_BPS),
});

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null));

export const paymentDetailsSchema = z.object({
  upiId: optionalText(100).refine((value) => value === null || /^[\w.-]{2,}@[\w.-]{2,}$/.test(value), {
    message: "A UPI id looks like name@bank",
  }),
  qrRef: ownImage.nullable().optional().transform((value) => value ?? null),
  accountName: optionalText(120),
  accountNumber: optionalText(34).refine((value) => value === null || /^\d{6,20}$/.test(value), {
    message: "Digits only, 6 to 20 of them",
  }),
  ifsc: optionalText(11).refine((value) => value === null || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value.toUpperCase()), {
    message: "An IFSC is 11 characters, like HDFC0001234",
  }).transform((value) => (value ? value.toUpperCase() : null)),
  bankName: optionalText(120),
});
export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;

/** A settlement recorded paid needs its proof (Q18); cancelling needs nothing. */
export const settlementStatusSchema = z.discriminatedUnion("status", [
  paymentProofSchema.extend({ status: z.literal("PAID") }),
  z.object({ status: z.literal("CANCELLED") }),
]);
export type SettlementStatusInput = z.infer<typeof settlementStatusSchema>;
