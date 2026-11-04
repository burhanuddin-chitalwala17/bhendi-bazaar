"use client";


import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { CancelReasons } from "@/components/order/cancel/cancel-reasons";
import { CancelRefused } from "@/components/order/cancel/cancel-refused";
import { SHOP_CANCEL_REASON, SHOP_CANCEL_REASON_LABEL, type ShopCancelReason } from "@server/checkout/parcel-cancel.types";
import { ADMIN_CANCEL_COPY } from "./pickups-copy";
import { useAdminCancel } from "./useAdminCancel";
import { ADMIN_CANCEL_PARCEL_COPY } from "./pickups-copy";

/** ux.md "admin cancel sheet": a reason from the shop's list, no fee. Never disabled (R15). */
export function AdminCancelParcel({ shipmentId }: { shipmentId: string }) {
  const cancel = useAdminCancel(shipmentId);
  const reason = cancel.form.watch("reason") as ShopCancelReason | undefined;
  const errors = cancel.form.formState.errors;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => cancel.setOpen(true)}>
        <Icon name="parcel-cancelled" />
        {ADMIN_CANCEL_COPY.open}
      </Button>
      <FormDialog
        open={cancel.open}
        onOpenChange={cancel.setOpen}
        title={ADMIN_CANCEL_COPY.title}
        description={cancel.refused ? undefined : ADMIN_CANCEL_COPY.intro}
      >
        {cancel.refused ? (
          <CancelRefused message={cancel.refused} onDone={cancel.closeRefused} />
        ) : (
          <form onSubmit={cancel.submit} noValidate className="space-y-3 pt-2">
            <CancelReasons
              labels={SHOP_CANCEL_REASON_LABEL}
              otherKey={SHOP_CANCEL_REASON.OTHER}
              value={reason}
              onPick={(r) => cancel.form.setValue("reason", r, { shouldValidate: cancel.form.formState.isSubmitted })}
              otherField={cancel.form.register("other")}
              error={errors.reason?.message}
              otherError={errors.other?.message}
            />
            {cancel.form.formError && (
              <p role="alert" className="text-small text-destructive">
                {cancel.form.formError}
              </p>
            )}
            <div className="flex flex-col gap-2 md:flex-row-reverse">
              <Button type="submit" variant="destructive" size="lg" pending={cancel.form.isSubmitting}>
                {cancel.form.isSubmitting ? ADMIN_CANCEL_COPY.cancelling : ADMIN_CANCEL_COPY.confirm}
              </Button>
              <Button type="button" variant="outline" size="lg" onClick={() => cancel.setOpen(false)}>
                {ADMIN_CANCEL_COPY.keep}
              </Button>
            </div>
          </form>
        )}
      </FormDialog>
    </>
  );
}
