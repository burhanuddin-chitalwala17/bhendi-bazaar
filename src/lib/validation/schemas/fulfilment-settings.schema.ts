import { z } from "zod";

/** ux.md "admin fee setting" Terminal error: one message for every way the amount is wrong. */
export const FEE_ERROR = "Enter an amount from ₹0 to ₹1,000, in whole rupees.";

/** The admin's cancellation fee (order-fulfilment D14): whole rupees, ₹0–1,000, against the version seen. */
export const fulfilmentFeeSchema = z.object({
  feeRupees: z.number({ error: FEE_ERROR }).int(FEE_ERROR).min(0, FEE_ERROR).max(1000, FEE_ERROR),
  seenVersion: z.number().int().min(0),
});
export type FulfilmentFeeInput = z.infer<typeof fulfilmentFeeSchema>;
