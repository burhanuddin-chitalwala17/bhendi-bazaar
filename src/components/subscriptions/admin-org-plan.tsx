import { Card } from "@/components/ui/card";
import { featureAccessService } from "@server/subscriptions/feature-access.service";
import { PlanSwitchRow } from "./plan-switch-row";
import { PLAN_TAB_COPY } from "./subscriptions-copy";

interface Props {
  orgId: string;
  shop: string;
}

/** The admin shop console's Plan tab (subscriptions/feature-access, ux.md Plan tab). */
export async function AdminOrgPlan({ orgId, shop }: Props) {
  const plan = await featureAccessService.planFor(orgId);
  if (plan.homeBrand) {
    return <Card className="p-5 text-small">{PLAN_TAB_COPY.homeBrand(shop)}</Card>;
  }
  return (
    <Card className="space-y-2 p-5">
      <p className="text-small text-muted-foreground">{PLAN_TAB_COPY.lead}</p>
      <ul>
        {plan.switches.map((row) => (
          <PlanSwitchRow key={row.feature} orgId={orgId} shop={shop} covers={PLAN_TAB_COPY.covers[row.feature]} row={row} />
        ))}
      </ul>
    </Card>
  );
}
