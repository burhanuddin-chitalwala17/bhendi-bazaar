"use client";

import { ExternalLink, Loader2, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/shared/forms/FormField";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { BOOKING_COPY, SHIPROCKET_URL } from "./pickups-copy";
import { useBookPickup } from "./useBookPickup";

const F = BOOKING_COPY.fields;

/**
 * The admin's hand booking (ux.md "admin book pickup", spec R5): six fields from Shiprocket.
 * The save button is never disabled (R15): a press while saving does nothing.
 */
export function BookPickup({ shipmentId, courierName }: { shipmentId: string; courierName: string | null }) {
  const { open, setOpen, form, submit, refresh } = useBookPickup(shipmentId, courierName);
  const errors = form.formState.errors;

  return (
    <>
      <Button size="sm" className="min-h-10" onClick={() => setOpen(true)}>
        <Truck className="mr-2 size-4" />
        {BOOKING_COPY.open}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title={BOOKING_COPY.title} description={BOOKING_COPY.hint}>
        <form onSubmit={submit} noValidate className="space-y-3 overflow-y-auto pt-2">
          <a href={SHIPROCKET_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-sm text-primary hover:underline">
            {BOOKING_COPY.openShiprocket} <ExternalLink className="size-3" />
          </a>
          <div className="grid grid-cols-2 gap-3">
            <FormInput type="date" label={F.pickupDate} error={errors.pickupDate?.message} {...form.register("pickupDate")} />
            <FormInput type="date" label={F.estimatedDelivery} error={errors.estimatedDelivery?.message} {...form.register("estimatedDelivery")} />
          </div>
          <FormInput label={F.courierName} error={errors.courierName?.message} {...form.register("courierName")} />
          <FormInput label={F.trackingNumber} autoComplete="off" error={errors.trackingNumber?.message} {...form.register("trackingNumber")} />
          <FormInput type="url" inputMode="url" label={F.trackingUrl} error={errors.trackingUrl?.message} {...form.register("trackingUrl")} />
          <FormInput type="url" inputMode="url" label={F.labelUrl} error={errors.labelUrl?.message} {...form.register("labelUrl")} />
          {form.formError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
              <span className="break-words">{form.formError}</span>
              <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={refresh}>
                {BOOKING_COPY.refresh}
              </Button>
            </div>
          )}
          <Button type="submit" className="min-h-11 w-full" aria-busy={form.isSubmitting}>
            {form.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {form.isSubmitting ? BOOKING_COPY.saving : BOOKING_COPY.save}
          </Button>
        </form>
      </FormDialog>
    </>
  );
}
