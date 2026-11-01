"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useServerForm } from "@/hooks/core/useServerForm";
import { pickupDateChangeSchema, type PickupDateChangeInput } from "@/lib/validation/schemas/booking.schema";
import { pickupsApiClient } from "./pickupsApiClient";
import { DATE_COPY } from "./pickups-copy";

/**
 * "Change pickup date" (order-fulfilment D11). Opens with the booked dates; the booked pickup
 * date travels as `seenPickupDate`, so a change someone made meanwhile is refused, not overwritten.
 * The caller keys it by those dates, so after a refresh it remounts with the new ones.
 */
export function useChangePickupDate(shipmentId: string, booked: { pickupDate: string; estimatedDelivery: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useServerForm<PickupDateChangeInput>({
    schema: pickupDateChangeSchema,
    defaultValues: { ...booked, seenPickupDate: booked.pickupDate },
    submit: (data) => pickupsApiClient.changeDates(shipmentId, data),
    successMessage: DATE_COPY.success,
    fallbackMessage: DATE_COPY.retry,
    toastErrors: false,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const pickupMoved = form.watch("pickupDate") !== booked.pickupDate;
  const etaKept = form.watch("estimatedDelivery") === booked.estimatedDelivery;
  const unchanged = () => {
    const v = form.getValues();
    return v.pickupDate === booked.pickupDate && v.estimatedDelivery === booked.estimatedDelivery;
  };
  const submit = (event?: React.BaseSyntheticEvent) => {
    if (form.isSubmitting) return undefined;
    // Saving the dates as booked would email the shop and buyer about nothing.
    if (unchanged()) {
      event?.preventDefault();
      setOpen(false);
      return undefined;
    }
    return form.onSubmit(event).catch(() => undefined);
  };
  return { open, setOpen, form, submit, alsoCheckEta: pickupMoved && etaKept, refresh: () => router.refresh() };
}
