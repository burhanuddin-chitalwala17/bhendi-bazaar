"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { HANDOFF_WIDE, HandoffSheet } from "@/components/shared/overlays/handoff-sheet";
import { useMutation } from "@/hooks/core/useMutation";

import { channelsApiClient } from "./channelsApiClient";
import { INSTAGRAM, INSTAGRAM_APP_URL } from "./channel-copy";

interface TurnOnRepliesSheetProps {
  orgId: string;
  /** What opens it, one element: the card's main button, the checklist step, or the return note's action. */
  trigger: ReactNode;
}

/**
 * The three taps that let Bhendi Bazaar see the shop's messages (connect-instagram R6, Q16). Done
 * records that the shop did them; the step then waits for the first message to tick itself.
 */
export function TurnOnRepliesSheet({ orgId, trigger }: TurnOnRepliesSheetProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const done = useMutation(() => channelsApiClient.repliesTurnedOn(orgId), {
    showToast: false,
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      wide={HANDOFF_WIDE.SIDE}
      title={INSTAGRAM.sheet.title}
      closeLabel={INSTAGRAM.sheet.close}
      trigger={trigger}
    >
      <div className="flex flex-col gap-3 text-sm">
        <p>{INSTAGRAM.sheet.body}</p>
        <ol className="flex flex-col gap-1 font-medium">
          {INSTAGRAM.sheet.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-muted-foreground">{INSTAGRAM.sheet.privacy}</p>
        {done.error && (
          <p role="alert" className="text-destructive">
            {INSTAGRAM.sheet.failed}
          </p>
        )}
        <div className="flex flex-col gap-2 md:flex-row-reverse">
          <Button asChild className="min-h-11">
            <a href={INSTAGRAM_APP_URL} target="_blank" rel="noopener noreferrer">
              {INSTAGRAM.sheet.open}
            </a>
          </Button>
          <Button variant="outline" className="min-h-11" pending={done.isLoading} onClick={() => void done.mutate().catch(() => undefined)}>
            {INSTAGRAM.sheet.done}
          </Button>
        </div>
      </div>
    </HandoffSheet>
  );
}
