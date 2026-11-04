import { REFUND_REQUEST_STALE_MS } from "@server/payments/refund.types";
import { attentionRepository } from "@server/analytics/attention.repository";
import { salesRepository } from "@server/analytics/sales.repository";
import {
  ADMIN_ATTENTION,
  ADMIN_ATTENTION_HREF,
  ADMIN_ATTENTION_ORDER,
  ATTENTION_CAP,
  PARCEL_TO_BOOK_STALE_HOURS,
  PAYOUT_READY_AFTER_DAYS,
  SELLING_WINDOW_DAYS,
  type AdminAttention,
  type AdminAttentionCounts,
  type AdminAttentionItem,
  type AdminAttentionKey,
  type SellingLowStock,
  type ToPack,
} from "@server/analytics/attention.types";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Counts past their thresholds become items: nothing at zero, in severity order, at most five. */
export function adminAttentionItems(c: AdminAttentionCounts): AdminAttentionItem[] {
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  const candidates: Record<AdminAttentionKey, Omit<AdminAttentionItem, "key" | "href">> = {
    [ADMIN_ATTENTION.REFUNDS]: {
      count: c.refunds.count,
      waiting: { buyers: c.refunds.buyers, amountPaise: c.refunds.amountPaise },
      oldestAt: iso(c.refunds.oldestAt),
    },
    [ADMIN_ATTENTION.PARCELS_TO_BOOK]: { count: c.parcelsToBook.count, waiting: null, oldestAt: iso(c.parcelsToBook.oldestAt) },
    [ADMIN_ATTENTION.PAYOUTS]: {
      count: c.payouts.shops,
      waiting: { amountPaise: c.payouts.amountPaise },
      oldestAt: iso(c.payouts.oldestAt),
    },
    [ADMIN_ATTENTION.COURIER_CONFLICTS]: { count: c.courierConflicts.count, waiting: null, oldestAt: iso(c.courierConflicts.oldestAt) },
  };
  return ADMIN_ATTENTION_ORDER.filter((key) => candidates[key].count > 0)
    .slice(0, ATTENTION_CAP)
    .map((key) => ({ key, ...candidates[key], href: ADMIN_ATTENTION_HREF[key] }));
}

/** Every candidate's count at `now`, thresholds applied, zeros kept. */
export async function adminAttentionCounts(now: Date = new Date()): Promise<AdminAttentionCounts> {
  return await attentionRepository.adminCounts({
    requestInFlightAfter: new Date(now.getTime() - REFUND_REQUEST_STALE_MS),
    readyBefore: new Date(now.getTime() - PARCEL_TO_BOOK_STALE_HOURS * HOUR_MS),
    payoutEntryBefore: new Date(now.getTime() - PAYOUT_READY_AFTER_DAYS * DAY_MS),
  });
}

/** The admin's queue: one statement (Q31). Empty is the all-clear. */
export async function adminAttention(now: Date = new Date()): Promise<AdminAttention> {
  return { items: adminAttentionItems(await adminAttentionCounts(now)), readAt: now.toISOString() };
}

/** A shop's paid parcels still to pack: what its buyers wait on. */
export async function toPack(orgId: string): Promise<ToPack> {
  const { count, oldestPaidAt } = await salesRepository.toPack(orgId);
  return { count, oldestPaidAt: oldestPaidAt ? oldestPaidAt.toISOString() : null };
}

/** A shop's low stock, only where it sold in the last 30 days (Q31). */
export async function sellingLowStock(orgId: string, now: Date = new Date()): Promise<SellingLowStock> {
  return await salesRepository.sellingLowStock(orgId, new Date(now.getTime() - SELLING_WINDOW_DAYS * DAY_MS));
}
