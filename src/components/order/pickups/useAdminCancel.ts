"use client";

import { toast } from "sonner";

import { useCancelForm } from "@/components/order/cancel/useCancelForm";
import { shopCancelSchema, type ShopCancelInput } from "@/lib/validation/schemas/parcel-cancel.schema";
import { pickupsApiClient } from "./pickupsApiClient";
import { ADMIN_CANCEL_COPY, SHIPROCKET_URL } from "./pickups-copy";

/**
 * The admin's "Cancel parcel" (order-fulfilment D12, Q28). A booked parcel's success reminds the
 * admin to cancel its AWB on Shiprocket, since only a person can cancel the courier side.
 */
export function useAdminCancel(shipmentId: string) {
  return useCancelForm<ShopCancelInput, { awb: string | null }>({
    schema: shopCancelSchema,
    defaultValues: {},
    send: (data) => pickupsApiClient.cancel(shipmentId, data),
    onSent: ({ awb }) =>
      awb
        ? toast.warning(ADMIN_CANCEL_COPY.successBooked(awb), {
            duration: Infinity,
            action: { label: ADMIN_CANCEL_COPY.openShiprocket, onClick: () => window.open(SHIPROCKET_URL, "_blank", "noopener") },
          })
        : toast.success(ADMIN_CANCEL_COPY.success),
  });
}
