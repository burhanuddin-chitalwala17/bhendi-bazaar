"use client";

import { useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import {
  AVAILABLE_TOOLS,
  ENHANCEMENT_TOOL,
  TOOL_COPY,
  type AvailableTool,
  type EnhancementDto,
  type EnhancementUsage,
  type RequestEnhancementInput,
} from "@server/content/enhancement.types";
import {
  SCENE_ASPECT_COPY,
  SCENE_PRESETS,
  type ScenePresetKey,
} from "@server/content/scene-presets";
import type { ShotRole } from "@server/catalog/shot-list";
import { useEnhancementRun } from "@/hooks/product/useEnhancementRun";
import { MEDIA_COPY } from "./media-copy";

/**
 * The photo on the table. A gallery row knows only the URL it carries and the slot it fills; the
 * library knows the asset itself and no slot. Either names the photo — the boundary takes one or
 * the other, never both.
 */
export interface ImproveTarget {
  ref: string;
  assetId?: string | null;
  slot?: string | null;
  slotRole?: ShotRole | null;
}

interface ImproveDialogProps {
  orgId: string;
  /** Null closes the sheet. */
  target: ImproveTarget | null;
  /**
   * Start on this tool instead of listing them (image-enhancement spec R6): a capture warning
   * already named what is wrong and which improvement answers it, so asking again is a question
   * whose answer the sheet was handed.
   */
  preselect?: AvailableTool | null;
  /**
   * The proposal was kept. In a gallery the row that carried `ref` takes the result over; in the
   * library there is no row to take it, so the caller simply re-reads — the improved picture is a
   * new image beside the one it came from either way (spec R3).
   */
  onAccepted: (sourceRef: string, result: EnhancementDto) => void;
  onClose: () => void;
}

/**
 * What the boundary is asked for one run: the asset when the caller knows it, else the URL its row
 * carries. Naming both is refused, so the list and the preselected start build it the one way.
 * A setting travels only with the tool that has one, which the boundary also refuses otherwise.
 */
const askFor = (
  target: ImproveTarget,
  tool: AvailableTool,
  preset: ScenePresetKey | null,
): RequestEnhancementInput => ({
  tool,
  ...(preset ? { preset } : {}),
  ...(target.assetId ? { sourceAssetId: target.assetId } : { sourceRef: target.ref }),
  slot: target.slot ?? null,
  slotRole: target.slotRole ?? null,
});

/**
 * A tool that cannot start until a setting is chosen (image-enhancement spec R11). Only a scene
 * has one, and it is a list to pick from rather than a box to type in.
 */
const needsPreset = (tool: AvailableTool) => tool === ENHANCEMENT_TOOL.SCENE;

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
  preselect = null,
  onAccepted,
  onClose,
}: ImproveDialogProps) {
  const { run, usage, request, accept, discard, reset } =
    useEnhancementRun(orgId);
  const [picked, setPicked] = useState<AvailableTool | null>(null);
  /** What is running: the tool chosen from the list, else the one the warning already named. */
  const tool = picked ?? preselect;
  /** The setting the run was started with, so a retry asks for the same one. */
  const [setting, setSetting] = useState<ScenePresetKey | null>(null);
  /** The tool whose settings are on screen instead of the run: chosen, but not yet started. */
  const [choosing, setChoosing] = useState<AvailableTool | null>(null);
  const chooseFrom =
    choosing ?? (preselect && needsPreset(preselect) ? preselect : null);
  const [showing, setShowing] = useState<"before" | "after">("after");
  const busy = run.phase === "requesting" || run.phase === "deciding";

  const close = () => {
    reset();
    setPicked(null);
    setSetting(null);
    setChoosing(null);
    onClose();
  };

  const start = (chosen: AvailableTool, preset: ScenePresetKey | null = null) => {
    if (!target) return;
    setPicked(chosen);
    setSetting(preset);
    setChoosing(null);
    setShowing("after");
    void request(askFor(target, chosen, preset));
  };

  /** A tool with settings opens its list; every other one starts where it was tapped. */
  const choose = (chosen: AvailableTool) => {
    if (needsPreset(chosen)) return setChoosing(chosen);
    start(chosen);
  };

  // The sheet is opened by a tap in another component, so the run that tap asked for can only
  // start here. Once per opening, held by a ref rather than by the phase: discarding a proposal
  // returns the run to idle, and reading that as "nothing has started" would spend a second slot.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!target) {
      autoStarted.current = false;
      return;
    }
    // A preselected tool that still needs a setting cannot start on its own: the tiles open
    // instead, and the run begins on the one that is tapped.
    if (!preselect || needsPreset(preselect) || autoStarted.current) return;
    autoStarted.current = true;
    void request(askFor(target, preselect, null));
  }, [preselect, request, target]);

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
      title={MEDIA_COPY.improve.title}
      description={MEDIA_COPY.improve.description}
    >
      {target && run.phase === "idle" && !preselect && !chooseFrom && (
        <ul
          className="min-h-0 flex-1 space-y-2 overflow-y-auto"
          aria-label={MEDIA_COPY.improve.improvements}
        >
          {AVAILABLE_TOOLS.map((candidate) => (
            <li key={candidate}>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                onClick={() => choose(candidate)}
              >
                <Icon name="enhance" />
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

      {/* The settings are the whole choice a scene offers: a fixed list, never a box to type in
          (spec R11). Nothing is spent until one is tapped. */}
      {target && run.phase === "idle" && chooseFrom && (
        <>
          {choosing && (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="shrink-0 self-start"
              onClick={() => setChoosing(null)}
            >
              <Icon name="back" /> {MEDIA_COPY.improve.allImprovements}
            </Button>
          )}
          <ul
            className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto"
            aria-label={MEDIA_COPY.improve.sceneSettings}
          >
            {SCENE_PRESETS.map((preset) => (
              <li key={preset.key}>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-auto w-full justify-start whitespace-normal py-3 text-left"
                  onClick={() => start(chooseFrom, preset.key)}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{preset.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {SCENE_ASPECT_COPY[preset.aspect]}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}

      {target && (run.phase === "requesting" || run.phase === "running") && (
        <>
          <Frame src={target.ref} alt={MEDIA_COPY.improve.beingImproved}>
            <span className="absolute inset-0 flex items-center justify-center gap-2 bg-scrim/40 text-sm font-medium text-hero-foreground">
              <Spinner /> {MEDIA_COPY.improve.improving}
            </span>
          </Frame>
          <p className="text-xs text-muted-foreground">
            {MEDIA_COPY.improve.duration}
          </p>
        </>
      )}

      {target && (run.phase === "proposed" || run.phase === "deciding") && (
        <>
          <div
            className="flex shrink-0 gap-2"
            role="group"
            aria-label={MEDIA_COPY.improve.compare}
          >
            <Button
              type="button"
              size="lg"
              className="flex-1"
              variant={showing === "before" ? "default" : "outline"}
              aria-pressed={showing === "before"}
              onClick={() => setShowing("before")}
            >
              {MEDIA_COPY.improve.before}
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              variant={showing === "after" ? "default" : "outline"}
              aria-pressed={showing === "after"}
              onClick={() => setShowing("after")}
            >
              {MEDIA_COPY.improve.after}
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
                ? MEDIA_COPY.improve.afterAlt
                : MEDIA_COPY.improve.beforeAlt
            }
          />
          <div className="flex shrink-0 gap-2 bg-background pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => void drop()}
              pending={busy}
            >
              {!busy && <Icon name="close" />} {MEDIA_COPY.improve.discard}
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1"
              onClick={() => void keep()}
              pending={busy}
            >
              {!busy && <Icon name="done" />}
              {MEDIA_COPY.improve.accept}
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
              onClick={() => (tool ? start(tool, setting) : reset())}
            >
              <Icon name="refresh" /> {MEDIA_COPY.improve.retry}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={close}>
              {MEDIA_COPY.improve.close}
            </Button>
          </div>
        </>
      )}

      {/* The warning belongs before the choice; once a run is under way the count already includes it. */}
      {usage && <UsageLine usage={usage} beforeRunning={run.phase === "idle"} />}
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
    <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-card bg-muted">
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

/**
 * One line, never a modal (trd, UI approach): what the shop has used, or why it is paused — and,
 * before a tool is chosen, that running one spends it whichever way the answer goes. The work is
 * what costs, not the keeping of it, and that is said beforehand rather than discovered after.
 */
function UsageLine({ usage, beforeRunning = false }: { usage: EnhancementUsage; beforeRunning?: boolean }) {
  if (usage.paused) {
    return (
      <p className="text-xs text-muted-foreground">
        Enhancement is paused for your shop{usage.pauseReason ? `: ${usage.pauseReason}` : ""}.
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {usage.used} of {usage.allowance} this month.
      {beforeRunning && " Each one you run counts, whether you keep it or not."}
    </p>
  );
}
