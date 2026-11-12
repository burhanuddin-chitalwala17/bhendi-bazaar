"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { formatShortDate } from "@/lib/format";
import type { FeatureSwitchDTO } from "@server/subscriptions/feature-access.types";
import { usePlanSwitch } from "./usePlanSwitch";
import { FEATURE_NAME, PLAN_TAB_COPY, TURN_OFF_COPY } from "./subscriptions-copy";

interface Props {
  orgId: string;
  shop: string;
  covers: string;
  row: FeatureSwitchDTO;
}

/** One paid feature on the admin's Plan tab: its switch, who changed it and when (ux.md, D12). */
export function PlanSwitchRow({ orgId, shop, covers, row }: Props) {
  const name = FEATURE_NAME[row.feature];
  const s = usePlanSwitch(orgId, shop, row.feature, row.enabled);
  const by = row.changedBy?.name ?? row.changedBy?.email ?? PLAN_TAB_COPY.someone;
  const state = row.changedAt
    ? (row.enabled ? PLAN_TAB_COPY.on : PLAN_TAB_COPY.off)(formatShortDate(row.changedAt), by)
    : PLAN_TAB_COPY.neverSwitched;

  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-small font-semibold">{name}</p>
        <p className="text-small text-muted-foreground">{covers}</p>
        <p className={row.enabled ? "text-small text-success" : "text-small text-muted-foreground"}>{state}</p>
      </div>
      <Switch
        checked={row.enabled}
        onCheckedChange={s.request}
        aria-label={PLAN_TAB_COPY.switchLabel(name)}
        aria-busy={s.pending}
      />
      <FormDialog
        open={s.confirming}
        onOpenChange={s.setConfirming}
        title={TURN_OFF_COPY.title(name, shop)}
        description={TURN_OFF_COPY.what[row.feature]}
      >
        <p className="text-small text-muted-foreground">{TURN_OFF_COPY.kept}</p>
        <div className="flex flex-col gap-2 pt-2 md:flex-row-reverse">
          <Button variant="destructive" size="lg" pending={s.pending} onClick={s.confirmOff}>
            {TURN_OFF_COPY.confirm}
          </Button>
          <Button variant="outline" size="lg" onClick={() => s.setConfirming(false)}>
            {TURN_OFF_COPY.keep}
          </Button>
        </div>
      </FormDialog>
    </li>
  );
}
