import { SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";

/** Why a parcel's refund is owed (order-fulfilment Q25): the state it moved into. Unit 5 writes the first. */
export const REFUND_CAUSE = {
  CANCELLED: SHIPMENT_STATUS.CANCELLED,
  RTO_DELIVERED: SHIPMENT_STATUS.RTO_DELIVERED,
  LOST: SHIPMENT_STATUS.LOST,
  DAMAGED: SHIPMENT_STATUS.DAMAGED,
} as const;
export type RefundCause = (typeof REFUND_CAUSE)[keyof typeof REFUND_CAUSE];

/** The refund's lifecycle (D16, D17), as the `RefundState` enum stores it. */
export const REFUND_STATE = {
  OWED: "OWED",
  REQUESTED: "REQUESTED",
  STARTED: "STARTED",
  UNCONFIRMED: "UNCONFIRMED",
  FAILED: "FAILED",
} as const;
export type RefundState = (typeof REFUND_STATE)[keyof typeof REFUND_STATE];

/** A parcel's refund as its buyer sees it on the order (ux.md "buyer order": Success: cancelled). */
export interface BuyerRefundView {
  shipmentId: string;
  amountPaise: number;
  state: RefundState;
  /** India day it started, "3 Nov"; null until it has. */
  startedDay: string | null;
}

/** The states a refund may be started from. REQUESTED joins them once it is stale (D17). */
export const REFUND_STARTABLE: readonly RefundState[] = [REFUND_STATE.OWED, REFUND_STATE.UNCONFIRMED, REFUND_STATE.FAILED];

/** A request still REQUESTED after this has lost its answer: shown, and retried, as unconfirmed (D17). */
export const REFUND_REQUEST_STALE_MS = 2 * 60_000;

/** What the admin is shown: a REQUESTED row whose answer never came reads as UNCONFIRMED. */
export function shownRefundState(state: RefundState, requestedAt: Date | null, now: Date = new Date()): RefundState {
  const stale = state === REFUND_STATE.REQUESTED && (!requestedAt || now.getTime() - requestedAt.getTime() > REFUND_REQUEST_STALE_MS);
  return stale ? REFUND_STATE.UNCONFIRMED : state;
}

/** What pressing "Refund ₹{x}" came to (ux.md "admin refunds"). */
export type RefundStartOutcome =
  | { kind: "started"; gatewayRefundId: string; amountPaise: number }
  | { kind: "refused"; reason: string }
  | { kind: "unconfirmed" }
  /** Another press got there first: the row was already started, or is being. */
  | { kind: "already" };

/** One refund row for the admin's list, before checkout adds its order and parcel. */
export interface AdminRefundRecord {
  id: string;
  orderId: string;
  shipmentId: string;
  amountPaise: number;
  cause: RefundCause;
  state: RefundState;
  gatewayRefundId: string | null;
  failureReason: string | null;
  createdAt: Date;
  startedAt: Date | null;
}
