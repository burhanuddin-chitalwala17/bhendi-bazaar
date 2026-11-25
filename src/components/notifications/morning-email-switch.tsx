"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { NOTIFICATIONS_UI_COPY } from "./notifications-copy";
import { useMorningEmail } from "./useMorningEmail";

const COPY = NOTIFICATIONS_UI_COPY.settings;

/** "Morning email · 9 am" (ux journey 4): the badge and Status alerts stay whatever it says. */
export function MorningEmailSwitch({ orgId, initial }: { orgId: string; initial: boolean }) {
  const { on, toggle, saving } = useMorningEmail(orgId, initial);
  return (
    <div className="space-y-2 rounded-card border border-border bg-card p-4">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <Label htmlFor="morning-email" className="text-body">
          {COPY.morningEmail}
        </Label>
        <Switch id="morning-email" checked={on} onCheckedChange={toggle} disabled={saving} />
      </div>
      <p className="text-small text-muted-foreground">{COPY.statusNote}</p>
    </div>
  );
}
