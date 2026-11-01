"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";
import { HintCards } from "./hint-cards";
import { HINT_COPY, pageHelp } from "./portal-hints";
import type { PortalNavKey } from "./portal-nav";

/** A page header's "?" (R5; Q11): the page's purpose line, then its hint cards. Opens only on a tap. */
export function PageHelp({ help }: { help: PortalNavKey }) {
  const [open, setOpen] = useState(false);
  const content = pageHelp(help);
  if (!content) return null;

  const gotIt = (
    <Button className="min-h-11" onClick={() => setOpen(false)}>
      {HINT_COPY.gotIt}
    </Button>
  );

  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      wide={HANDOFF_WIDE.POPOVER}
      title={content.title}
      closeLabel={HINT_COPY.close}
      description={content.purpose}
      trigger={
        <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label={HINT_COPY.pageHelp}>
          <CircleHelp className="size-5" />
        </Button>
      }
    >
      {content.cards.length > 0 ? <HintCards cards={content.cards} finish={gotIt} /> : <div className="flex justify-end">{gotIt}</div>}
    </HandoffSheet>
  );
}
