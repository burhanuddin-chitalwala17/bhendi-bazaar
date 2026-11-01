"use client";

import { Loader2, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { SHOP_ORDERS_COPY, SHOP_PARCEL_COPY } from "./parcel-copy";
import { useMarkReady } from "./useMarkReady";

interface Props {
  orgId: string;
  shipmentId: string;
  /** The shop's first order: the one-line hint under the button (ux.md "First use"). */
  firstOrder: boolean;
  /** Docked above the phone's tab bar only when it is the page's one action, so two never stack. */
  docked: boolean;
}

/**
 * "Ready for pickup" on a parcel still being packed (spec R3). Phone: docked above the tab bar
 * (ADR-0016); `lg:` sits in the card header. Never disabled (R15).
 */
export function ReadyForPickup({ orgId, shipmentId, firstOrder, docked }: Props) {
  const ready = useMarkReady(orgId, shipmentId);

  return (
    <>
      <div className={docked ? "fixed inset-x-0 bottom-tabbar z-10 border-t bg-card p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0" : "w-full lg:w-auto"}>
        <Button className="min-h-11 w-full lg:w-auto" onClick={ready.open} aria-busy={ready.sending}>
          {ready.sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <PackageCheck className="mr-2 size-4" />}
          {ready.sending ? SHOP_PARCEL_COPY.marking : SHOP_PARCEL_COPY.ready}
        </Button>
        {firstOrder && <p className="mt-2 text-sm text-muted-foreground">{SHOP_PARCEL_COPY.firstUseHint}</p>}
      </div>

      <FormDialog
        open={ready.confirming}
        onOpenChange={(open) => (open ? ready.open() : ready.close())}
        title={SHOP_PARCEL_COPY.confirmTitle}
        description={SHOP_PARCEL_COPY.confirmBody}
      >
        <Button className="mt-4 min-h-11 w-full" onClick={ready.confirm} aria-busy={ready.sending}>
          {ready.sending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {ready.sending ? SHOP_PARCEL_COPY.marking : SHOP_PARCEL_COPY.confirmYes}
        </Button>
      </FormDialog>

      <FormDialog
        open={ready.problem !== null}
        onOpenChange={(open) => !open && ready.dismissProblem()}
        title={ready.problem?.message ?? ""}
      >
        <Button variant="outline" className="mt-4 min-h-11 w-full" onClick={ready.dismissProblem}>
          {ready.problem?.kind === "cancelled" ? SHOP_PARCEL_COPY.ok : SHOP_ORDERS_COPY.refresh}
        </Button>
      </FormDialog>
    </>
  );
}
