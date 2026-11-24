"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";

import { PLANNED_WHY } from "./channel-copy";

/** Why a social platform is not open yet (meta-foundation R10, A5): the card's one action. */
export function PlannedChannelWhy({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      wide={HANDOFF_WIDE.POPOVER}
      title={PLANNED_WHY.title(label)}
      closeLabel={PLANNED_WHY.close}
      description={PLANNED_WHY.body}
      trigger={
        <Button variant="outline" className="min-h-11" aria-label={PLANNED_WHY.openLabel(label)}>
          {PLANNED_WHY.open}
        </Button>
      }
    >
      <Button className="min-h-11 w-full" onClick={() => setOpen(false)}>
        {PLANNED_WHY.done}
      </Button>
    </HandoffSheet>
  );
}
