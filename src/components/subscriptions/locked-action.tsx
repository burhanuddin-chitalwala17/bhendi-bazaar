"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { holds, type Feature } from "@server/subscriptions/feature-access.types";
import { LockedSheet } from "./locked-sheet";
import { useShopPlan } from "./plan-context";

type ButtonProps = React.ComponentProps<typeof Button>;

/**
 * One paid action (feature-access D12 UI, Q20, Q29). Held: its child, unchanged, so the unlocked app is
 * what it was. Locked: the same button, never disabled, a lock before its label, opening the sheet.
 */
export function LockedAction({
  feature,
  label,
  children,
  variant,
  size,
  className,
}: {
  feature: Feature;
  label: ReactNode;
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { shop, features } = useShopPlan();
  if (holds(features, feature)) return <>{children}</>;
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Icon name="lock" size="xs" />
        {label}
      </Button>
      <LockedSheet feature={feature} shop={shop} open={open} onOpenChange={setOpen} />
    </>
  );
}
