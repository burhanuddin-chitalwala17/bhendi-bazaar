import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { STEP_STATE, type ChecklistStep, type ChecklistStepDTO } from "@server/channels/social/checklist";

export interface ChecklistRow extends ChecklistStepDTO {
  label: string;
  /** A line under the step, such as how to make it tick sooner. */
  hint?: string;
  /** Wraps the row's label to open the step's own screen; absent while the step has none. */
  open?: (label: ReactNode) => ReactNode;
}

function Tick({ state }: { state: ChecklistStepDTO["state"] }) {
  if (state === STEP_STATE.DONE) return <Icon name="success" size="sm" tone="success" />;
  // Dashed: the shop did its part, and the platform has yet to show it (connect-instagram Q16).
  if (state === STEP_STATE.WAITING) return <span aria-hidden className="size-4 shrink-0 rounded-full border border-dashed border-primary" />;
  return <Icon name="dot" size="sm" tone={state === STEP_STATE.NEXT ? "primary" : "muted"} />;
}

/**
 * A social card's setup steps (connect-instagram R12; shared with WhatsApp's card): done steps dim,
 * the next bold, a waiting step says what it waits for (ux.md "Partial", "Waiting for a message").
 */
export function ChannelSetupChecklist({ label, rows, waitingText }: { label: string; rows: ChecklistRow[]; waitingText: string }) {
  return (
    <ol aria-label={label} className="flex flex-col gap-1">
      {rows.map((row) => {
        const text = (
          <span
            className={cn(
              "flex min-h-10 items-center gap-2 text-left",
              row.state === STEP_STATE.DONE && "text-muted-foreground",
              row.state === STEP_STATE.NEXT && "font-semibold text-foreground",
            )}
          >
            <Tick state={row.state} />
            <span>
              {row.label}
              {row.state === STEP_STATE.WAITING ? ` · ${waitingText}` : ""}
            </span>
          </span>
        );
        return (
          <li key={row.step satisfies ChecklistStep} aria-current={row.state === STEP_STATE.NEXT ? "step" : undefined}>
            {row.open && row.state !== STEP_STATE.DONE ? row.open(text) : text}
            {row.hint && <p className="pl-6 text-small text-muted-foreground">{row.hint}</p>}
          </li>
        );
      })}
    </ol>
  );
}
