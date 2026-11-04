"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CONFLICT_COPY } from "./pickups-copy";
import { useDismissConflict } from "./useDismissConflict";
import { CONFLICT_ACTIONS_COPY } from "./pickups-copy";

/** Never disabled (R15): a press while dismissing does nothing. */
export function DismissConflict({ conflictId }: { conflictId: string }) {
  const { dismiss, dismissing } = useDismissConflict(conflictId);
  return (
    <Button size="sm" variant="outline" onClick={dismiss} pending={dismissing}>
      {dismissing ? CONFLICT_COPY.dismissing : CONFLICT_COPY.dismiss}
    </Button>
  );
}

/** The raw update, behind "Show details" (ux.md Long content). */
export function ConflictDetails({ payload }: { payload: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Button size="sm" variant="ghost" className="px-0" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? CONFLICT_COPY.hideDetails : CONFLICT_COPY.showDetails}
      </Button>
      {open && (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-card bg-muted p-3 text-caption">{payload}</pre>
      )}
    </div>
  );
}
