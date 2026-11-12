"use client";

import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import type { Feature } from "@server/subscriptions/feature-access.types";
import { TalkToUs } from "./talk-to-us";
import { FEATURE_NAME, LOCK_COPY } from "./subscriptions-copy";

/**
 * What a locked action says on tap (feature-access ux.md "Refused", Q20): the feature, what it does, the
 * price, and one way forward. A bottom sheet on a phone, a dialog from md (ADR-0040's short-form pair).
 */
export function LockedSheet({
  feature,
  shop,
  open,
  onOpenChange,
}: {
  feature: Feature;
  shop: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const name = FEATURE_NAME[feature];
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={LOCK_COPY.partOfPlan(name)} description={LOCK_COPY.value[feature]}>
      <p className="text-small text-muted-foreground">{LOCK_COPY.price}</p>
      <div className="flex flex-col gap-2 pt-2 md:flex-row-reverse">
        <TalkToUs feature={feature} shop={shop} className="h-10 w-full md:w-auto" />
        <Button variant="outline" size="lg" onClick={() => onOpenChange(false)}>
          {LOCK_COPY.notNow}
        </Button>
      </div>
    </FormDialog>
  );
}
