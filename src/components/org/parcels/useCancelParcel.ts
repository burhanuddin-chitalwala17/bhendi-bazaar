"use client";

import { toast } from "sonner";

import { useCancelForm } from "@/components/order/cancel/useCancelForm";
import { shopCancelSchema, type ShopCancelInput } from "@/lib/validation/schemas/parcel-cancel.schema";
import { parcelApiClient } from "./parcelApiClient";
import { SHOP_CANCEL_COPY } from "./parcel-copy";

/** The shop's "Cancel parcel" (order-fulfilment D12, R10): a reason is required; the fee comes back from the server. */
export function useCancelParcel(orgId: string, shipmentId: string) {
  return useCancelForm<ShopCancelInput, { feePaise: number }>({
    schema: shopCancelSchema,
    defaultValues: {},
    send: (data) => parcelApiClient.cancel(orgId, shipmentId, data),
    onSent: ({ feePaise }) => toast.success(SHOP_CANCEL_COPY.success(feePaise)),
  });
}
