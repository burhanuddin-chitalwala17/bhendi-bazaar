"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";
import { HintCards } from "@/components/layout/hint-cards";
import { HINT_COPY, type StepHint } from "@/components/layout/portal-hints";
import { stepRowClass } from "./step-row";

/** A setup step that opens its hint on a tap (R4; A5); the last card's button starts the task. */
export function SetupStepHint({
  title,
  hint,
  href,
  isNext,
  children,
}: {
  title: string;
  hint: StepHint;
  href: string;
  isNext: boolean;
  /** The row's contents: the tick, the title, the chevron. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      wide={HANDOFF_WIDE.POPOVER}
      title={title}
      closeLabel={HINT_COPY.close}
      trigger={
        <Button
          variant="ghost"
          aria-current={isNext ? "step" : undefined}
          className={stepRowClass(isNext)}
        >
          {children}
        </Button>
      }
    >
      <HintCards
        cards={hint.cards}
        finish={
          <Button asChild className="min-h-11">
            <Link href={href}>{hint.action}</Link>
          </Button>
        }
      />
    </HandoffSheet>
  );
}
