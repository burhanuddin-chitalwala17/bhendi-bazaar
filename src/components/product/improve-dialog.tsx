"use client";

import { useState } from "react";
import NextImage from "next/image";
import { Check, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import {
  AVAILABLE_TOOLS,
  TOOL_COPY,
  type AvailableTool,
  type EnhancementDto,
  type EnhancementUsage,
} from "@server/content/enhancement.types";
import type { ShotRole } from "@server/catalog/shot-list";
import { useEnhancementRun } from "@/hooks/product/useEnhancementRun";

/** The photo on the table: the URL its row carries, the slot it fills and that slot's role. */
export interface ImproveTarget {
  ref: string;
  slot: string | null;
  slotRole: ShotRole | null;
}

interface ImproveDialogProps {
  orgId: string;
  /** Null closes the sheet. */
  target: ImproveTarget | null;
  /** The proposal was kept: the row that carried `sourceRef` takes the result over. */
  onAccepted: (sourceRef: string, result: EnhancementDto) => void;
  onClose: () => void;
}

/** The compare view's slot: the sheet is full width on a phone and a 36rem panel from md. */
const COMPARE_SIZES = "(min-width: 768px) 36rem, 100vw";

/**
 * Pick one improvement, wait, compare, decide (image-enhancement spec R1, R3, R12): the tools that
 * exist as a list with one line each, "Improving…" over the photo while the worker runs, then a
 * before/after toggle with Accept and Discard docked beneath. A refusal or a failure is one line
 * with a retry, never a modal (R10). Only the sheet's own state is here; the run is the hook's.
 */
export function ImproveDialog({
  orgId,
  target,
  onAccepted,
  onClose,
}: ImproveDialogProps) {
  const { run, usage, request, accept, discard, reset } =
    useEnhancementRun(orgId);
  const [tool, setTool] = useState<AvailableTool | null>(null);
  const [showing, setShowing] = useState<"before" | "after">("after");
  const busy = run.phase === "requesting" || run.phase === "deciding";

  const close = () => {
    reset();
    setTool(null);
    onClose();
  };

  const start = (chosen: AvailableTool) => {
    if (!target) return;
    setTool(chosen);
    setShowing("after");
    void request({
      tool: chosen,
      sourceRef: target.ref,
      slot: target.slot,
      slotRole: target.slotRole,
    });
  };

  const keep = async () => {
    if (!target) return;
    const result = await accept();
    if (result) {
      onAccepted(target.ref, result);
      close();
    }
  };

  const drop = async () => {
    if (await discard()) close();
  };

  return (
    <TaskDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      title="Improve this photo"
      description="One change at a time. You see before and after, and nothing is kept until you say so."
    >
      {target && run.phase === "idle" && (
        <ul className="space-y-2" aria-label="Improvements">
          {AVAILABLE_TOOLS.map((candidate) => (
            <li key={candidate}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                onClick={() => start(candidate)}
              >
                <Sparkles />
                <span className="min-w-0">
                  <span className="block font-medium">
                    {TOOL_COPY[candidate].label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {TOOL_COPY[candidate].line}
                  </span>
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      {target && (run.phase === "requesting" || run.phase === "running") && (
        <>
          <Frame src={target.ref} alt="The photo being improved">
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-scrim/40 text-sm font-medium text-hero-foreground">
              <Loader2 className="animate-spin" aria-hidden /> Improving…
            </span>
          </Frame>
          <p className="text-xs text-muted-foreground">
            Usually under a minute. You can close this and come back.
          </p>
        </>
      )}

      {target && (run.phase === "proposed" || run.phase === "deciding") && (
        <>
          <div className="flex gap-2" role="group" aria-label="Compare">
            <Button
              type="button"
              size="lg"
              className="flex-1"
              variant={showing === "before" ? "default" : "outline"}
              aria-pressed={showing === "before"}
              onClick={() => setShowing("before")}
              disabled={busy}
            >
              Before
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              variant={showing === "after" ? "default" : "outline"}
              aria-pressed={showing === "after"}
              onClick={() => setShowing("after")}
              disabled={busy}
            >
              After
            </Button>
          </div>
          <Frame
            src={
              showing === "after"
                ? (run.enhancement.proposalUrl ?? target.ref)
                : target.ref
            }
            alt={
              showing === "after"
                ? "After the improvement"
                : "Before the improvement"
            }
          />
          <div className="sticky bottom-0 flex gap-2 bg-background pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => void drop()}
              disabled={busy}
            >
              <X /> Discard
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              onClick={() => void keep()}
              disabled={busy}
            >
              {run.phase === "deciding" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Accept
            </Button>
          </div>
        </>
      )}

      {run.phase === "failed" && (
        <>
          <p role="alert" className="text-sm text-destructive">
            {run.message}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => (tool ? start(tool) : reset())}
            >
              <RotateCcw /> Retry
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={close}>
              Close
            </Button>
          </div>
        </>
      )}

      {usage && <UsageLine usage={usage} />}
    </TaskDialog>
  );
}

/** The photo, large, in a square that fits the sheet; a child overlays it. */
function Frame({
  src,
  alt,
  children,
}: {
  src: string;
  alt: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-card bg-muted">
      <NextImage
        src={src}
        alt={alt}
        fill
        sizes={COMPARE_SIZES}
        className="object-contain"
      />
      {children}
    </div>
  );
}

/** One line, never a modal (trd, UI approach): what the shop has used, or why it is paused. */
function UsageLine({ usage }: { usage: EnhancementUsage }) {
  return (
    <p className="text-xs text-muted-foreground">
      {usage.paused
        ? `Enhancement is paused for your shop${usage.pauseReason ? `: ${usage.pauseReason}` : ""}.`
        : `${usage.used} of ${usage.allowance} this month.`}
    </p>
  );
}
