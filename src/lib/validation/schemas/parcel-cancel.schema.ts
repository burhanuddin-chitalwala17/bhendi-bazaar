import { z } from "zod";
import {
  BUYER_CANCEL_REASON,
  BUYER_CANCEL_REASON_LABEL,
  CANCEL_OTHER_MAX,
  SHOP_CANCEL_REASON,
  SHOP_CANCEL_REASON_LABEL,
  cancelReasonText,
  type BuyerCancelReason,
  type ShopCancelReason,
} from "@server/checkout/parcel-cancel.types";

/** Copy exactly as order-fulfilment ux.md "shop cancel sheet" and "admin cancel sheet" sign it off. */
export const CANCEL_ERRORS = {
  pickReason: "Pick a reason.",
  other: "Tell us the reason in a few words.",
} as const;

const shopReasons = Object.values(SHOP_CANCEL_REASON) as [ShopCancelReason, ...ShopCancelReason[]];
const buyerReasons = Object.values(BUYER_CANCEL_REASON) as [BuyerCancelReason, ...BuyerCancelReason[]];
const other = z.string().trim().max(CANCEL_OTHER_MAX, CANCEL_ERRORS.other).optional();

/**
 * The shop's and the admin's cancel (R10, Q21): a reason is required, and "Other" needs words.
 * The reason is the only input — what is refunded, restocked or charged is the server's.
 */
export const shopCancelSchema = z
  .object({
    reason: z.enum(shopReasons, { error: CANCEL_ERRORS.pickReason }),
    other,
  })
  .refine((v) => v.reason !== SHOP_CANCEL_REASON.OTHER || !!v.other, { message: CANCEL_ERRORS.other, path: ["other"] });
export type ShopCancelInput = z.infer<typeof shopCancelSchema>;

/** The buyer's cancel: the reason is optional (Q21), so nothing here can be wrong. */
export const buyerCancelSchema = z.object({
  reason: z.enum(buyerReasons).optional(),
  other,
});
export type BuyerCancelInput = z.infer<typeof buyerCancelSchema>;

/** The words the timeline keeps for each. */
export const shopCancelReason = (v: ShopCancelInput) =>
  cancelReasonText(SHOP_CANCEL_REASON_LABEL, v.reason, v.other, SHOP_CANCEL_REASON.OTHER);
export const buyerCancelReason = (v: BuyerCancelInput) =>
  cancelReasonText(BUYER_CANCEL_REASON_LABEL, v.reason, v.other, BUYER_CANCEL_REASON.OTHER);
