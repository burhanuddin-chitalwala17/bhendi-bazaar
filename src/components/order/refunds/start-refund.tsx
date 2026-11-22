"use client";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { REFUNDS_COPY } from "./refunds-copy";
import { useStartRefund } from "./useStartRefund";
import { START_REFUND_COPY } from "./refunds-copy";

/** "Refund ₹{x}" or "Try again", then the confirm sheet (ux.md copy deck). Never disabled (R15). */
export function StartRefund({
  refundId,
  amountPaise,
  retry = false,
  buyerEmailed = true,
}: {
  refundId: string;
  amountPaise: number;
  retry?: boolean;
  buyerEmailed?: boolean;
}) {
  const refund = useStartRefund(refundId, amountPaise, buyerEmailed);
  return (
    <>
      <Button size="sm" variant={retry ? "outline" : "default"} onClick={() => refund.setOpen(true)}>
        {retry ? REFUNDS_COPY.tryAgain : REFUNDS_COPY.open(amountPaise)}
      </Button>
      <FormDialog open={refund.open} onOpenChange={refund.setOpen} title={REFUNDS_COPY.open(amountPaise)} description={REFUNDS_COPY.confirmIntro(amountPaise)}>
        <div className="flex flex-col gap-2 pt-2 md:flex-row-reverse">
          <Button type="button" variant="destructive" size="lg" onClick={refund.start} pending={refund.starting}>
            {refund.starting ? REFUNDS_COPY.refunding : REFUNDS_COPY.confirm(amountPaise)}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => refund.setOpen(false)}>
            {REFUNDS_COPY.keep}
          </Button>
        </div>
      </FormDialog>
    </>
  );
}
