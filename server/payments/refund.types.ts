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
