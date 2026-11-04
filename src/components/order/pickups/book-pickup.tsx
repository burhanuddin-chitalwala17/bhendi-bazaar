"use client";


import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
      <Button size="sm" onClick={() => setOpen(true)}>
        <Icon name="delivery" />
        {BOOKING_COPY.open}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title={BOOKING_COPY.title} description={BOOKING_COPY.hint}>
        <form onSubmit={submit} noValidate className="space-y-3 overflow-y-auto pt-2">
          <a href={SHIPROCKET_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 text-small text-primary hover:underline">
            {BOOKING_COPY.openShiprocket} <Icon name="external" size="xs" />
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
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-small text-destructive">
              <span className="break-words">{form.formError}</span>
              <Button type="button" size="sm" variant="outline" onClick={refresh}>
                {BOOKING_COPY.refresh}
              </Button>
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" pending={form.isSubmitting}>
            {form.isSubmitting ? BOOKING_COPY.saving : BOOKING_COPY.save}
          </Button>
        </form>
      </FormDialog>
    </>
  );
}
