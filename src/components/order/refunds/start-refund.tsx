"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { REFUNDS_COPY } from "./refunds-copy";
import { useStartRefund } from "./useStartRefund";

/** "Refund ₹{x}" or "Try again", then the confirm sheet (ux.md copy deck). Never disabled (R15). */
export function StartRefund({ refundId, amountPaise, retry = false }: { refundId: string; amountPaise: number; retry?: boolean }) {
  const refund = useStartRefund(refundId, amountPaise);
  return (
    <>
      <Button size="sm" variant={retry ? "outline" : "default"} className="min-h-10" onClick={() => refund.setOpen(true)}>
        {retry ? REFUNDS_COPY.tryAgain : REFUNDS_COPY.open(amountPaise)}
      </Button>
      <FormDialog open={refund.open} onOpenChange={refund.setOpen} title={REFUNDS_COPY.open(amountPaise)} description={REFUNDS_COPY.confirmIntro(amountPaise)}>
        <div className="flex flex-col gap-2 pt-2 md:flex-row-reverse">
          <Button type="button" variant="destructive" className="min-h-11" onClick={refund.start} aria-busy={refund.starting}>
            {refund.starting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {refund.starting ? REFUNDS_COPY.refunding : REFUNDS_COPY.confirm(amountPaise)}
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => refund.setOpen(false)}>
            {REFUNDS_COPY.keep}
          </Button>
        </div>
      </FormDialog>
    </>
  );
}
