"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useServerForm } from "@/hooks/core/useServerForm";
import { bookingSchema, type BookingInput } from "@/lib/validation/schemas/booking.schema";
import { pickupsApiClient } from "./pickupsApiClient";
import { BOOKING_COPY } from "./pickups-copy";

/**
 * "Book pickup" (order-fulfilment D11): the panel's open state and its form. The courier opens
 * prefilled from checkout's rate; a refusal (AWB taken, cancelled, booked by someone else) shows
 * inline, the AWB one on its field.
 */
export function useBookPickup(shipmentId: string, courierName: string | null) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useServerForm<BookingInput>({
    schema: bookingSchema,
    defaultValues: { courierName: courierName ?? "", pickupDate: "", estimatedDelivery: "", trackingNumber: "", trackingUrl: "", labelUrl: "" },
    submit: (data) => pickupsApiClient.book(shipmentId, data),
    successMessage: BOOKING_COPY.success,
    fallbackMessage: BOOKING_COPY.retry,
    toastErrors: false,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  const submit = (event?: React.BaseSyntheticEvent) => (form.isSubmitting ? undefined : form.onSubmit(event).catch(() => undefined));
  return { open, setOpen, form, submit, refresh: () => router.refresh() };
}
