"use client";

import type { ComponentType } from "react";

import { MARKETPLACE_KIND } from "@server/requests/marketplace/marketplace.types";

import { MarketplacePlan } from "./marketplace/marketplace-plan";

/** What a kind's preview component is given; its plan and choice are its own (setup-requests D4). */
export interface RequirementPlanProps {
  id: string;
  kind: string;
  shopsWaiting: number | null;
}

/**
 * Which component previews and applies each kind. The detail page renders whichever its ticket's kind
 * names and never names a kind itself; a module plugs in by adding its line here.
 */
const PLANS: Record<string, ComponentType<RequirementPlanProps>> = {
  [MARKETPLACE_KIND.FIELDS]: MarketplacePlan,
  [MARKETPLACE_KIND.CATEGORY]: MarketplacePlan,
};

export function RequirementPlan(props: RequirementPlanProps) {
  const Plan = PLANS[props.kind];
  return Plan ? <Plan {...props} /> : null;
}
