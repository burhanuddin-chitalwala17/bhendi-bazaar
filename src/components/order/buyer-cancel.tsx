"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { CancelReasons } from "@/components/order/cancel/cancel-reasons";
import { CancelRefused } from "@/components/order/cancel/cancel-refused";
import { BUYER_CANCEL_REASON, BUYER_CANCEL_REASON_LABEL, type BuyerCancelReason } from "@server/checkout/parcel-cancel.types";
import { BUYER_CANCEL_COPY } from "./buyer-cancel-copy";
import { useBuyerCancel } from "./useBuyerCancel";

/**
 * The buyer's cancel on one parcel (ux.md "buyer cancel sheet", R10, Q13). While the shop is packing
 * it opens the sheet; once packed it explains and points to Contact us — never a dead button (R15).
 */
export function BuyerCancel({
  orderId,
  shipmentId,
  packing,
  multiParcel,
  shopName,
  refundPaise,
}: {
  orderId: string;
  shipmentId: string;
  packing: boolean;
  multiParcel: boolean;
  shopName: string | null;
  refundPaise: number;
}) {
  const cancel = useBuyerCancel(orderId, shipmentId);
  const [explaining, setExplaining] = useState(false);
  const reason = cancel.form.watch("reason") as BuyerCancelReason | undefined;
  const label = multiParcel ? BUYER_CANCEL_COPY.cancelItems : BUYER_CANCEL_COPY.cancelOrder;
  const intro = multiParcel && shopName ? BUYER_CANCEL_COPY.introFrom(shopName, refundPaise) : BUYER_CANCEL_COPY.intro(refundPaise);

  return (
    <>
      <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => (packing ? cancel.setOpen(true) : setExplaining(true))}>
        {label}
      </Button>

      <FormDialog open={explaining} onOpenChange={setExplaining} title={label}>
        <CancelRefused message={BUYER_CANCEL_COPY.afterReady} contactUs onDone={() => setExplaining(false)} />
      </FormDialog>

      <FormDialog open={cancel.open} onOpenChange={cancel.setOpen} title={label} description={cancel.refused ? undefined : intro}>
        {cancel.refused ? (
          <CancelRefused message={cancel.refused} onDone={cancel.closeRefused} />
        ) : (
          <form onSubmit={cancel.submit} noValidate className="space-y-3 pt-2">
            <CancelReasons
              labels={BUYER_CANCEL_REASON_LABEL}
              otherKey={BUYER_CANCEL_REASON.OTHER}
              value={reason}
              onPick={(r) => cancel.form.setValue("reason", r)}
              otherField={cancel.form.register("other")}
              otherError={cancel.form.formState.errors.other?.message}
            />
            {cancel.form.formError && (
              <p role="alert" className="text-sm text-destructive">
                {cancel.form.formError}
              </p>
            )}
            <div className="flex flex-col gap-2 md:flex-row-reverse">
              <Button type="submit" variant="destructive" className="min-h-11" aria-busy={cancel.form.isSubmitting}>
                {cancel.form.isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
                {cancel.form.isSubmitting ? BUYER_CANCEL_COPY.cancelling : BUYER_CANCEL_COPY.confirm}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => cancel.setOpen(false)}>
                {BUYER_CANCEL_COPY.keep}
              </Button>
            </div>
          </form>
        )}
      </FormDialog>
    </>
  );
}
