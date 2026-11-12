"use client";

import { Icon, type IconName } from "@/components/ui/icon";
import { holds, type Feature } from "@server/subscriptions/feature-access.types";
import { useShopPlan } from "./plan-context";

/** A paid action's own mark, or a lock while its feature is off, so the button says so before the tap (Q20). */
export function PlanIcon({ feature, name, size }: { feature: Feature; name?: IconName; size?: "xs" | "sm" | "md" }) {
  const { features } = useShopPlan();
  if (holds(features, feature)) return name ? <Icon name={name} size={size} /> : null;
  return <Icon name="lock" size={size ?? "xs"} />;
}
