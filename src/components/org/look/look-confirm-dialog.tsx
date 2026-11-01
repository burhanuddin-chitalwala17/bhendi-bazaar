"use client";

import { Loader2 } from "lucide-react";

import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { Button } from "@/components/ui/button";
import { LOOK_COPY } from "./look-copy";
import { WRITE_STATE, type useLookWrite } from "./useLookWrite";

/**
 * The confirm before a look goes live — Publish or Switch back (ux.md journeys 1, 3, 4): the
 * question, then on failure what is still live with "Try again", and when another member got
 * there first, who and when with "See it" and a resend. Every button stays tappable.
 */
export function LookConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  busyLabel,
  failedCopy,
  anywayLabel,
  onSeeIt,
  write,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  busyLabel: string;
  /** "Not published. Your shop still shows {current}." */
  failedCopy: string;
  anywayLabel: string;
  onSeeIt: () => void;
  write: ReturnType<typeof useLookWrite>;
}) {
  const stale = write.state === WRITE_STATE.STALE;
  const failed = write.state === WRITE_STATE.FAILED;
  const gone = write.state === WRITE_STATE.GONE;
  const label = stale ? anywayLabel : failed ? LOOK_COPY.tryAgain : confirmLabel;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) write.reset();
        onOpenChange(next);
      }}
      title={title}
      description={body}
    >
      <div className="space-y-4">
        {(stale || failed || gone) && (
          <p role="alert" className="rounded-field bg-muted p-3 text-sm text-foreground">
            {stale || gone ? write.refusal : (write.refusal ?? failedCopy)}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {stale ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={onSeeIt}>
              {LOOK_COPY.seeIt}
            </Button>
          ) : (
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              {LOOK_COPY.notYet}
            </Button>
          )}
          {!gone && (
            <Button type="button" className="min-h-11" aria-busy={write.busy} onClick={() => void write.run()}>
              {write.slow && <Loader2 className="animate-spin" aria-hidden />}
              {write.slow ? busyLabel : label}
            </Button>
          )}
        </div>
      </div>
    </FormDialog>
  );
}
