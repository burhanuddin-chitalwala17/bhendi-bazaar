"use client";

import type { Feature } from "@server/subscriptions/feature-access.types";
import { TalkToUs } from "./talk-to-us";
import { useShopPlan } from "./plan-context";
import { FEATURE_NAME, LOCK_COPY } from "./subscriptions-copy";

/** Over a paid feature's own screen while it is locked (feature-access ux.md plan banner). The screen stays. */
export function PlanBanner({ feature }: { feature: Feature }) {
  const { shop } = useShopPlan();
  return (
    <div role="note" className="flex flex-col gap-1 rounded-card border border-border bg-primary/10 px-4 py-3 text-small sm:flex-row sm:items-center sm:justify-between">
      <span className="font-medium">{LOCK_COPY.bannerLine(FEATURE_NAME[feature])}</span>
      <TalkToUs feature={feature} shop={shop} variant="link" className="h-auto justify-start p-0" />
    </div>
  );
}
