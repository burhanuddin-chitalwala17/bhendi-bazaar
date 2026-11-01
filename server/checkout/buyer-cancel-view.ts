import { refundPreview } from "@server/checkout/fulfilment-cancel";
import { refundService } from "@server/payments/refund.service";
import { promotionService } from "@server/promotions/promotion.service";
import { REFUND_STATE } from "@server/payments/refund.types";

/** A cancelled parcel's refund as its buyer reads it: the amount, and the day it started once it has. */
export interface BuyerRefundLine {
  amountPaise: number;
  started: boolean;
  startedDay: string | null;
}

/** What the buyer's order page shows about cancelling (ux.md "buyer order", "buyer cancel sheet"). */
export interface BuyerCancelView {
  /** Each cancelled parcel's refund, by parcel id. */
  refunds: Record<string, BuyerRefundLine>;
  /** What cancelling each parcel would give back now, paise. */
  preview: Record<string, number>;
  /** The coupon codes the buyer can use again: only once every parcel is cancelled (own-store Q5). */
  couponsBack: string[];
}

/** One read for the buyer's order page: refunds owed, what a cancel would give back, the coupon line. */
export async function buyerCancelView(orderId: string, everyParcelCancelled: boolean): Promise<BuyerCancelView> {
  const refunds = await refundService.forOrder(orderId);
  const owed = refunds.reduce((sum, r) => sum + r.amountPaise, 0);
  const [preview, couponsBack] = await Promise.all([
    refundPreview(orderId, owed),
    everyParcelCancelled ? promotionService.couponCodesForOrder(orderId) : Promise.resolve([]),
  ]);
  return {
    refunds: Object.fromEntries(
      refunds.map((r) => [r.shipmentId, { amountPaise: r.amountPaise, started: r.state === REFUND_STATE.STARTED, startedDay: r.startedDay }]),
    ),
    preview,
    couponsBack,
  };
}
