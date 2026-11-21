"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import { MediaLibraryPicker } from "@/components/product/media-library-picker";
import type { ImproveTarget } from "@/components/product/improve-dialog";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { formatCurrency } from "@/lib/format";
import { uploadBatch } from "@/lib/image/upload-batch";
import { orgUploadEndpoints } from "@/lib/image/upload-endpoints";
import { buildImagePath } from "@server/catalog/image-paths";
import { ROUTES } from "@server/shared/routes";
import {
  STYLED_ASPECT,
  STYLED_BRIEF_MAX,
  STYLED_FACE,
  type EnhancementDto,
  type StyledAspect,
  type StyledFace,
  type StyledQuoteDto,
} from "@server/content/enhancement.types";
import { styledShotApiClient } from "./styledShotApiClient";
import { useStyledShotRun } from "./useStyledShotRun";
import { STYLED_SHOT_COPY as C } from "./styled-shot-copy";
import { settleHeldUpload } from "./held-references";

interface StyledShotDialogProps {
  orgId: string;
  /** Names the shop's upload folder, for a reference from the device; without it only the library is offered. */
  orgCode?: string | null;
  /** Null closes the dialog. */
  target: ImproveTarget | null;
  /** In the product form "Use this" takes the photo's place; in the library the picture is already kept (Q33). */
  inForm?: boolean;
  onUse: (sourceRef: string, result: EnhancementDto) => void;
  onClose: () => void;
}

const THUMB = "64px";

/** The shapes on offer, in the order shown (Q42). */
const SHAPES: ReadonlyArray<[StyledAspect, { label: string; hint: string }]> = [
  [STYLED_ASPECT.SQUARE, C.shapes.square],
  [STYLED_ASPECT.PORTRAIT, C.shapes.portrait],
  [STYLED_ASPECT.TALL, C.shapes.tall],
  [STYLED_ASPECT.LANDSCAPE, C.shapes.landscape],
];

/** A picture from the device, held in the page until Generate: one removed before then never reaches the library (Q43). */
interface HeldFile {
  file: File;
  preview: string;
}

/**
 * Improve with AI (ai-images/improve-with-ai, ux.md journeys 1, 2, 4, 5): describe → working → the
 * result, with every version kept and one tap to the original. Full screen on a phone (Q32). The
 * form scrolls under a fixed Generate; the picture takes the room its controls leave, in its own shape.
 */
export function StyledShotDialog({ orgId, orgCode, target, inForm = false, onUse, onClose }: StyledShotDialogProps) {
  const open = target !== null;
  const [brief, setBrief] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [held, setHeld] = useState<HeldFile[]>([]);
  const [face, setFace] = useState<StyledFace>(STYLED_FACE.NO_FACE);
  const [aspect, setAspect] = useState<StyledAspect | null>(null);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const [briefError, setBriefError] = useState(false);
  const [aspectError, setAspectError] = useState(false);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [index, setIndex] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const { run, versions, request, reset, backToForm } = useStyledShotRun(orgId, {
    couldNotStart: C.couldNotStart,
    couldNotCheck: C.couldNotCheck,
  });
  const extra = refs.length + held.length;
  const quote = useAsyncData<StyledQuoteDto>(
    (signal) => styledShotApiClient.quote(orgId, extra, aspect ?? STYLED_ASPECT.SQUARE, signal),
    { enabled: open && run.phase === "idle", refetchDependencies: [open, extra, aspect, run.phase] },
  );

  // A held picture's preview is a blob: URL the page owns; let it go with the picture.
  const heldRef = useRef(held);
  heldRef.current = held;
  useEffect(() => () => heldRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  /** Let go of held pictures (all, unless `keep` says otherwise), revoking their previews after the render that drops them. */
  const dropHeld = (keep: (item: HeldFile) => boolean = () => false) => {
    const gone = held.filter((item) => !keep(item));
    setHeld(held.filter(keep));
    setTimeout(() => gone.forEach((item) => URL.revokeObjectURL(item.preview)));
  };

  const close = () => {
    reset();
    setBrief("");
    setRefs([]);
    dropHeld();
    setFace(STYLED_FACE.NO_FACE);
    setAspect(null);
    setPreviousId(null);
    setBriefError(false);
    setAspectError(false);
    setIndex(0);
    setShowOriginal(false);
    onClose();
  };

  const limit = quote.data?.maxExtraReferences ?? 0;
  const short = quote.data !== null && quote.data.balancePaise < quote.data.heldPaise;
  const current = versions[Math.min(index, versions.length - 1)] ?? null;

  /**
   * The held pictures, uploaded now that they will be used; null when any did not make it. Those that
   * did become references either way, so trying again uploads only the ones that failed.
   */
  const uploadHeld = async (): Promise<string[] | null> => {
    if (held.length === 0) return [];
    if (!orgCode) return null;
    setUploading(true);
    try {
      const batch = await uploadBatch(held.map((item) => item.file), {
        endpoints: orgUploadEndpoints(orgId),
        pathFor: (file) => buildImagePath("org", file.name, "library", orgCode),
      });
      const { uploaded, stillHeld } = settleHeldUpload(held, batch.urls);
      if (stillHeld.length === 0) return uploaded;
      setRefs((items) => [...items, ...uploaded.filter((url) => !items.includes(url))]);
      dropHeld((item) => stillHeld.includes(item));
      toast.error(C.uploadFailed);
      return null;
    } catch {
      toast.error(C.uploadFailed);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    if (!target || uploading) return;
    const missingBrief = !brief.trim();
    setBriefError(missingBrief);
    setAspectError(aspect === null);
    if (missingBrief || aspect === null) return;
    const uploaded = await uploadHeld();
    if (uploaded === null) return;
    const referenceRefs = [...refs, ...uploaded];
    // Uploaded once: a retry or a regenerate follows the library copies, never the files again.
    setRefs(referenceRefs);
    dropHeld();
    await request({
      ...(target.assetId ? { sourceAssetId: target.assetId } : { sourceRef: target.ref }),
      brief: brief.trim(),
      referenceRefs,
      face,
      aspect,
      previousId,
      slot: target.slot ?? null,
      slotRole: target.slotRole ?? null,
    });
    setIndex(Number.MAX_SAFE_INTEGER);
  };

  const addRef = (ref: string) => setRefs((items) => (items.includes(ref) || extra >= limit ? items : [...items, ref]));

  const fromDevice = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, limit - extra));
    event.target.value = "";
    setHeld((items) => [...items, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const regenerate = () => {
    setPreviousId(current?.id ?? null);
    if (current?.aspect) setAspect(current.aspect);
    setBriefError(false);
    setAspectError(false);
    backToForm();
  };

  const use = () => {
    if (!target || !current) return;
    onUse(target.ref, current);
    toast.success(inForm ? C.photoReplaced : C.savedToLibrary);
    close();
  };

  const title = run.phase === "done" ? C.resultTitle : C.title;

  return (
    <TaskDialog open={open} onOpenChange={(next) => !next && close()} title={title} width="canvas">
      {target && run.phase === "idle" && (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <p className="text-small text-muted-foreground">{previousId ? C.regenerateHelp : C.help}</p>
            {!previousId && (
              <div className="flex flex-wrap gap-2">
                {C.examples.map((example) => (
                  <Button key={example} type="button" variant="outline" size="sm" className="h-auto whitespace-normal" onClick={() => setBrief(example)}>
                    {example}
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              <Textarea
                value={brief}
                maxLength={STYLED_BRIEF_MAX}
                rows={3}
                placeholder={C.placeholder}
                aria-label={C.title}
                aria-invalid={briefError}
                onChange={(event) => {
                  setBrief(event.target.value);
                  setBriefError(false);
                }}
              />
              <div className="flex justify-between text-caption">
                <span className="text-destructive">{briefError ? C.needsBrief : ""}</span>
                <span className="text-muted-foreground">{C.count(brief.length, STYLED_BRIEF_MAX)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{C.references}</Label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-card bg-muted">
                  <NextImage src={target.ref} alt={C.yourPhoto} fill sizes={THUMB} className="object-cover" />
                </div>
                {refs.map((ref) => (
                  <Button
                    key={ref}
                    type="button"
                    variant="ghost"
                    aria-label={C.removeReference}
                    className="relative size-16 shrink-0 overflow-hidden rounded-card bg-muted p-0"
                    onClick={() => setRefs((items) => items.filter((item) => item !== ref))}
                  >
                    <NextImage src={ref} alt="" fill sizes={THUMB} className="object-cover" />
                  </Button>
                ))}
                {held.map((item) => (
                  <Button
                    key={item.preview}
                    type="button"
                    variant="ghost"
                    aria-label={C.removeReference}
                    className="relative size-16 shrink-0 overflow-hidden rounded-card bg-muted p-0"
                    onClick={() => dropHeld((other) => other !== item)}
                  >
                    <img src={item.preview} alt="" className="size-full object-cover" />
                  </Button>
                ))}
              </div>
              {extra < limit ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
                    <Icon name="add-photo" className="mr-2" />
                    {C.fromLibrary}
                  </Button>
                  {orgCode && (
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                      {C.fromDevice}
                    </Button>
                  )}
                  <span className="self-center text-caption text-muted-foreground">{C.upToMore(limit - extra)}</span>
                  <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={fromDevice} />
                </div>
              ) : (
                quote.data && <p className="text-caption text-muted-foreground">{C.atLimit}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{C.shape}</Label>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4" role="radiogroup" aria-label={C.shape} aria-invalid={aspectError}>
                {SHAPES.map(([value, { label, hint }]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={aspect === value ? "default" : "outline"}
                    role="radio"
                    aria-checked={aspect === value}
                    className="h-auto flex-col items-start whitespace-normal py-2 text-left"
                    onClick={() => {
                      setAspect(value);
                      setAspectError(false);
                    }}
                  >
                    <span>
                      {label} · {value}
                    </span>
                    <span className="text-caption font-normal opacity-80">{hint}</span>
                  </Button>
                ))}
              </div>
              {aspectError && <p className="text-caption text-destructive">{C.needsShape}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2" role="radiogroup">
              {([
                [STYLED_FACE.NO_FACE, C.noFace, C.noFaceHint],
                [STYLED_FACE.WITH_FACE, C.withFace, C.withFaceHint],
              ] as const).map(([value, label, hint]) => (
                <Button
                  key={value}
                  type="button"
                  variant={face === value ? "default" : "outline"}
                  role="radio"
                  aria-checked={face === value}
                  className="h-auto flex-col items-start whitespace-normal py-2 text-left"
                  onClick={() => setFace(value)}
                >
                  <span>{label}</span>
                  <span className="text-caption font-normal opacity-80">{hint}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="shrink-0 space-y-2 border-t border-border pt-3">
            {quote.error ? (
              <div className="flex items-center justify-between gap-2 text-small">
                <span className="text-destructive">{C.quoteFailed}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => quote.refetch()}>
                  {C.tryAgain}
                </Button>
              </div>
            ) : quote.data ? (
              <p className={`flex flex-wrap justify-between gap-2 text-small ${short ? "font-semibold text-warning" : "text-muted-foreground"}`}>
                <span>{C.cost(formatCurrency(quote.data.chargePaise))}</span>
                <span>{C.creditLeft(formatCurrency(quote.data.balancePaise))}</span>
              </p>
            ) : (
              <Skeleton className="h-5 w-full" />
            )}
            {short ? (
              <>
                <p className="text-small text-warning">{C.short}</p>
                <Button asChild className="w-full">
                  <Link href={ROUTES.org.libraryCredits(orgId)} onClick={close}>
                    {C.addCredit}
                  </Link>
                </Button>
              </>
            ) : (
              <Button type="button" className="w-full" pending={uploading} onClick={() => void generate()}>
                {uploading ? C.uploading : previousId ? C.generateAgain : C.generate}
              </Button>
            )}
          </div>
        </>
      )}

      {target && run.phase === "working" && (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-card bg-muted">
            <NextImage src={target.ref} alt={C.yourPhoto} fill sizes="(min-width: 768px) 48rem, 100vw" className="object-contain opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 font-semibold">
              <Spinner />
              {C.working}
            </div>
          </div>
          <p className="shrink-0 text-small text-muted-foreground">{run.slow ? C.stillWorking : C.workingHint}</p>
        </>
      )}

      {target && run.phase === "lost" && (
        <div className="space-y-3">
          <p className="text-small text-muted-foreground">{run.message}</p>
          <Button type="button" className="w-full" onClick={close}>
            {C.close}
          </Button>
        </div>
      )}

      {target && run.phase === "failed" && (
        <div className="space-y-3">
          <p className="text-small text-destructive">{run.message}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={backToForm}>
              {C.editDescription}
            </Button>
            <Button type="button" onClick={() => void request(run.input)}>
              {C.tryAgain}
            </Button>
          </div>
        </div>
      )}

      {target && run.phase === "done" && current?.resultRef && (
        <>
          {/* The picture takes whatever height the controls leave and keeps its own shape inside it. */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-card bg-muted">
            <NextImage
              src={showOriginal ? target.ref : current.resultRef}
              alt={showOriginal ? C.originalPhoto : C.newPicture}
              fill
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-contain"
            />
            <Button
              type="button"
              variant="outline"
              aria-label={C.seeOriginal}
              aria-pressed={showOriginal}
              className="absolute bottom-2 right-2 h-20 w-16 overflow-hidden rounded-card p-0 shadow-lifted"
              onClick={() => setShowOriginal((value) => !value)}
            >
              <NextImage src={showOriginal ? current.resultRef : target.ref} alt="" fill sizes={THUMB} className="object-cover" />
            </Button>
          </div>
          <div className="shrink-0 space-y-3">
            {versions.length > 1 && (
              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" size="lg" aria-label={C.previousVersion} onClick={() => setIndex(Math.max(0, Math.min(index, versions.length - 1) - 1))}>
                  <Icon name="previous" />
                </Button>
                <span className="text-small">{C.version(Math.min(index, versions.length - 1) + 1, versions.length)}</span>
                <Button type="button" variant="ghost" size="lg" aria-label={C.nextVersion} onClick={() => setIndex(Math.min(versions.length - 1, index + 1))}>
                  <Icon name="next" />
                </Button>
              </div>
            )}
            <p className="rounded-field bg-warning/10 p-3 text-small">{C.resultNote}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={regenerate}>
                {C.regenerate}
              </Button>
              <Button type="button" onClick={use}>
                <Icon name="success" className="mr-2" />
                {C.useThis}
              </Button>
            </div>
          </div>
        </>
      )}

      <MediaLibraryPicker
        orgId={orgId}
        open={picking}
        onOpenChange={setPicking}
        taken={new Set(refs)}
        kinds={["IMAGE"]}
        title={C.fromLibrary}
        description={C.pickerHelp}
        onPick={(asset) => addRef(asset.ref)}
        onUnpick={(asset) => setRefs((items) => items.filter((ref) => ref !== asset.ref))}
      />
    </TaskDialog>
  );
}
