import type { Prisma } from "@prisma/client";
import { promotionService } from "@server/promotions/promotion.service";
import { refundService } from "@server/payments/refund.service";
import { REFUND_CAUSE, type RefundCause } from "@server/payments/refund.types";
import { ledgerService } from "@server/payouts/ledger.service";
import { orderRepository } from "@server/checkout/order.repository";
import { budgetSharesFor, parcelShares, refundOwedPaise, type ParcelShare, type ShareParcel } from "@server/checkout/parcel-shares";

/** What a cancel gave: the refund owed and the shop's fee, paise (D14, D16). */
export interface GivenBack {
  refundPaise: number;
  feePaise: number;
}

/**
 * Everything a cancel gives back beyond restock and reversal, which shipping did in the move
 * (order-fulfilment D12–D14, D16): the parcel's share of each offer's budget, the coupon once the
 * whole order is cancelled, the refund owed, and the shop's fee when the shop cancelled. Each has
 * its own unique key, so a replay gives nothing twice. Answers what the notices report.
 */
export async function giveBack(
  parcel: { id: string; code: string; orgId: string; orderId: string },
  move: { byShop: boolean; orderNowCancelled: boolean },
  parcels: readonly ShareParcel[],
  tx: Prisma.TransactionClient,
): Promise<GivenBack> {
  const [basis, charges] = await Promise.all([
    orderRepository.refundBasis(parcel.orderId, tx),
    promotionService.budgetChargesForOrder(parcel.orderId, tx),
  ]);
  const lines = (basis?.items ?? []).map((l) => ({ ...l, orderItemId: l.id }));
  const shares = parcelShares(lines, parcels);

  await promotionService.releaseParcelBudget(
    { orderId: parcel.orderId, shipmentId: parcel.id },
    budgetSharesFor(parcel.id, charges, parcels, shares),
    tx,
  );
  // own-store Q5: a buyer who kept part of the order used the coupon.
  if (move.orderNowCancelled) await promotionService.releaseCouponUses(parcel.orderId, tx);

  const refundPaise = await oweRefund(parcel, REFUND_CAUSE.CANCELLED, parcels, tx, { basis, shares });

  // R12a: only the shop's own cancel costs it anything.
  const feePaise =
    move.byShop
      ? await ledgerService.chargeCancellationFee({ orgId: parcel.orgId, orderId: parcel.orderId, shipmentId: parcel.id, parcelCode: parcel.code }, tx)
      : 0;
  return { refundPaise, feePaise };
}

const CAUSES: readonly string[] = Object.values(REFUND_CAUSE);
/** Whether a parcel state is one a refund is owed for, as payments names it (Q25). */
export const isRefundCause = (status: string): status is RefundCause => CAUSES.includes(status);

/**
 * Record the one refund a parcel is owed (D16, Q11, Q25), whatever made it owed — a cancel, or
 * the courier losing, damaging or returning it. Its net lines plus its shipping, capped at what the
 * order captured less what its other parcels are owed. Answers the amount; 0 writes nothing.
 */
export async function oweRefund(
  parcel: { id: string; orderId: string },
  cause: RefundCause,
  parcels: readonly ShareParcel[],
  tx: Prisma.TransactionClient,
  known?: { basis: Awaited<ReturnType<typeof orderRepository.refundBasis>>; shares: Map<string, ParcelShare> },
): Promise<number> {
  const basis = known ? known.basis : await orderRepository.refundBasis(parcel.orderId, tx);
  const shares = known?.shares ?? parcelShares((basis?.items ?? []).map((l) => ({ ...l, orderItemId: l.id })), parcels);
  const own = parcels.find((p) => p.id === parcel.id);
  const refundPaise = refundOwedPaise({
    netItemsPaise: shares.get(parcel.id)?.netItemsPaise ?? 0,
    shippingCost: own?.shippingCost ?? 0,
    grandTotal: basis?.grandTotal ?? 0,
    alreadyOwedPaise: await refundService.owedSoFar(parcel.orderId, tx),
  });
  await refundService.recordOwed({ orderId: parcel.orderId, shipmentId: parcel.id, cause, amountPaise: refundPaise }, tx);
  return refundPaise;
}
