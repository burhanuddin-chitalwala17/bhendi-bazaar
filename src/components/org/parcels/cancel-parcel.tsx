"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { CancelReasons } from "@/components/order/cancel/cancel-reasons";
import { CancelRefused } from "@/components/order/cancel/cancel-refused";
import { SHOP_CANCEL_REASON, SHOP_CANCEL_REASON_LABEL, type ShopCancelReason } from "@server/checkout/parcel-cancel.types";
import { SHOP_CANCEL_COPY } from "./parcel-copy";
import { useCancelParcel } from "./useCancelParcel";

/**
 * "Cancel parcel" on the shop's own parcel (ux.md "Shop cancel sheet", R10, R12a). While packing
 * it opens the reason sheet; once ready it opens the explanation instead — never a dead button (R15, A7).
 */
export function CancelParcel({ orgId, shipmentId, packing, feeNowPaise }: { orgId: string; shipmentId: string; packing: boolean; feeNowPaise: number }) {
  const cancel = useCancelParcel(orgId, shipmentId);
  const [explaining, setExplaining] = useState(false);
  const reason = cancel.form.watch("reason") as ShopCancelReason | undefined;
  const errors = cancel.form.formState.errors;

  return (
    <>
      <Button variant="outline" className="min-h-11 w-full lg:w-auto" onClick={() => (packing ? cancel.setOpen(true) : setExplaining(true))}>
        {SHOP_CANCEL_COPY.open}
      </Button>

      <FormDialog open={explaining} onOpenChange={setExplaining} title={SHOP_CANCEL_COPY.title}>
        <CancelRefused message={SHOP_CANCEL_COPY.afterReady} contactUs onDone={() => setExplaining(false)} />
      </FormDialog>

      <FormDialog
        open={cancel.open}
        onOpenChange={cancel.setOpen}
        title={SHOP_CANCEL_COPY.title}
        description={cancel.refused ? undefined : SHOP_CANCEL_COPY.intro(feeNowPaise)}
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
              <p role="alert" className="text-sm text-destructive">
                {cancel.form.formError}
              </p>
            )}
            <div className="flex flex-col gap-2 md:flex-row-reverse">
              <Button type="submit" variant="destructive" className="min-h-11" aria-busy={cancel.form.isSubmitting}>
                {cancel.form.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {cancel.form.isSubmitting ? SHOP_CANCEL_COPY.cancelling : SHOP_CANCEL_COPY.confirm}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => cancel.setOpen(false)}>
                {SHOP_CANCEL_COPY.keep}
              </Button>
            </div>
          </form>
        )}
      </FormDialog>
    </>
  );
}
