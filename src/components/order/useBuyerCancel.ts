"use client";

import { toast } from "sonner";

import { useCancelForm } from "@/components/order/cancel/useCancelForm";
import { buyerCancelSchema, type BuyerCancelInput } from "@/lib/validation/schemas/parcel-cancel.schema";
import { orderApiClient } from "./orderApiClient";
import { BUYER_CANCEL_COPY } from "./buyer-cancel-copy";

/** The buyer's "Cancel order" / "Cancel these items" (order-fulfilment D12, Q13): the reason is optional. */
export function useBuyerCancel(orderId: string, shipmentId: string) {
  return useCancelForm<BuyerCancelInput, { refundPaise: number }>({
    schema: buyerCancelSchema,
    defaultValues: {},
    send: (data) => orderApiClient.cancelParcel(orderId, shipmentId, data),
    onSent: () => toast.success(BUYER_CANCEL_COPY.success),
  });
}
