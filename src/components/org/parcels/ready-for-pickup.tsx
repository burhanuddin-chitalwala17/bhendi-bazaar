"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ActionBar } from "@/components/shared/action-bar";
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
  /** The list card's shorter word for the same act ("Mark packed"); the parcel page keeps its own. */
  label?: string;
}

/**
 * "Ready for pickup" on a parcel still being packed (spec R3): the shop marks it packed and we
 * book the courier. Docked in the page's ActionBar when it is the one action. Never disabled (R15).
 */
export function ReadyForPickup({ orgId, shipmentId, firstOrder, docked, label }: Props) {
  const ready = useMarkReady(orgId, shipmentId);
  const button = (
    <Button className={docked ? "min-h-11 w-full md:w-auto" : undefined} size={docked ? "default" : "sm"} onClick={ready.open} pending={ready.sending}>
      {!ready.sending && <Icon name="parcel" size="sm" />}
      {ready.sending ? SHOP_PARCEL_COPY.marking : (label ?? SHOP_PARCEL_COPY.ready)}
    </Button>
  );
  const hint = firstOrder ? SHOP_PARCEL_COPY.firstUseHint : undefined;

  return (
    <>
      {docked ? (
        <ActionBar className="-mx-4 md:mx-0" status={hint}>
          {button}
        </ActionBar>
      ) : (
        <div>
          {button}
          {hint && <p className="mt-2 text-small text-muted-foreground">{hint}</p>}
        </div>
      )}

      <FormDialog
        open={ready.confirming}
        onOpenChange={(open) => (open ? ready.open() : ready.close())}
        title={SHOP_PARCEL_COPY.confirmTitle}
        description={SHOP_PARCEL_COPY.confirmBody}
      >
        <Button className="mt-4 min-h-11 w-full" onClick={ready.confirm} pending={ready.sending}>
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
