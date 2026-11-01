"use client";

import { CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/shared/forms/FormField";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { BOOKING_COPY, DATE_COPY } from "./pickups-copy";
import { useChangePickupDate } from "./useChangePickupDate";

/** ux.md "admin change pickup date": two dates, the booked one shown above. Never disabled (R15). */
export function ChangePickupDate({
  shipmentId,
  pickupDate,
  pickupDay,
  estimatedDelivery,
}: {
  shipmentId: string;
  pickupDate: string;
  pickupDay: string;
  estimatedDelivery: string;
}) {
  const { open, setOpen, form, submit, alsoCheckEta, refresh } = useChangePickupDate(shipmentId, { pickupDate, estimatedDelivery });
  const errors = form.formState.errors;

  return (
    <>
      <Button size="sm" variant="outline" className="min-h-10" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-2 size-4" />
        {DATE_COPY.open}
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title={DATE_COPY.title} description={DATE_COPY.current(pickupDay)}>
        <form onSubmit={submit} noValidate className="space-y-3 pt-2">
          <FormInput type="date" label={BOOKING_COPY.fields.pickupDate} error={errors.pickupDate?.message} {...form.register("pickupDate")} />
          <FormInput
            type="date"
            label={BOOKING_COPY.fields.estimatedDelivery}
            error={errors.estimatedDelivery?.message}
            hint={alsoCheckEta ? DATE_COPY.alsoCheck : undefined}
            {...form.register("estimatedDelivery")}
          />
          {form.formError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive">
              <span className="break-words">{form.formError}</span>
              <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={refresh}>
                {DATE_COPY.refresh}
              </Button>
            </div>
          )}
          <div className="flex flex-col gap-2 md:flex-row-reverse">
            <Button type="submit" className="min-h-11" aria-busy={form.isSubmitting}>
              {form.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {form.isSubmitting ? DATE_COPY.saving : DATE_COPY.save}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>
              {DATE_COPY.keep}
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}
