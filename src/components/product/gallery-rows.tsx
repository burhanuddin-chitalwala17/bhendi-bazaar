"use client";

import { ImproveSplitButton } from "@/components/content/improve-split-button";
import { useRef, type ChangeEvent, type ReactNode } from "react";
import { useShopPlan } from "@/components/subscriptions/plan-context";
import { Icon } from "@/components/ui/icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { fixForWarnings, type CaptureWarning } from "@server/catalog/capture-checks";
import type { AvailableTool } from "@server/content/enhancement.types";
import type { ProductMediaInput, ProductMediaState } from "@server/catalog/media";
import type { ShotList, ShotSlot } from "@server/catalog/shot-list";
import { SlotSilhouette } from "@/components/product/slot-silhouette";
import { MEDIA_COPY } from "./media-copy";

/**
 * The rows of the slot-guided gallery editor (media-library R4, R8, trd D4/D6). The manager
 * owns the state and the thumbnail — the local preview it renders is allowlisted there — and
 * these own the layout of one slot and one extra. Mobile-first: one column at base, every
 * control a visible 40px button, nothing revealed on hover.
 */

/**
 * A photo failed a capture check. Advisory, not a refusal (spec R8): the photo is already in the
 * gallery and saving is never blocked, so the banner offers to take it out or to keep it and hush.
 *
 * And, where a tool actually fixes what was found, to improve it right here (image-enhancement
 * spec R6) — a warning that only diagnoses leaves the org member with a problem and no next step.
 * A blurred photo offers nothing, because nothing un-blurs one.
 */
export function CaptureBanner({
  warnings,
  onRemove,
  onKeep,
  onImprove,
}: {
  warnings: CaptureWarning[];
  onRemove: () => void;
  onKeep: () => void;
  /** Opens the improve sheet on the tool that answers the warning. Absent where none is offered. */
  onImprove?: (tool: AvailableTool) => void;
}) {
  const fix = fixForWarnings(warnings);
  return (
    <Alert className="border-warning/40 [&>svg]:text-warning">
      <Icon name="warning" tone="warning" />
      <AlertTitle className="text-warning">{MEDIA_COPY.rows.worthALook}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning.check}>{warning.message}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {fix && onImprove && (
            <Button type="button" size="lg" onClick={() => onImprove(fix)}>
              <ImproveIcon /> {MEDIA_COPY.rows.improve}
            </Button>
          )}
          <Button type="button" variant="outline" size="lg" onClick={onRemove}>
            <Icon name="close" /> {MEDIA_COPY.rows.remove}
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onKeep}>
            {MEDIA_COPY.rows.keepAnyway}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface SlotRowProps {
  slot: ShotSlot;
  /** The photograph filling this slot, or null while it is empty. */
  item: ProductMediaInput | null;
  /** Rendered by the manager, which owns the local-preview logic. */
  thumb: ReactNode;
  warnings: CaptureWarning[];
  /** This slot's own upload is in flight. */
  uploading: boolean;
  /**
   * Any upload is in flight, or the gallery is full. The buttons stay tappable (product-form A8):
   * the manager's handlers answer a tap at the cap with the capacity notice.
   */
  busy: boolean;
  /** Says why a tap did nothing while another upload runs. */
  onBusy: () => void;
  canPickFromLibrary: boolean;
  onFiles: (files: File[]) => void;
  onPickFromLibrary: () => void;
  onDescribe: (description: string) => void;
  onCover: () => void;
  onMoveToExtra: () => void;
  onRemove: () => void;
  onKeepAnyway: () => void;
  /**
   * Opens the improve sheet, on a named tool when the warning offered one (spec R6). Absent on
   * the label slot, which is never enhanced (image-enhancement R5).
   */
  onImprove?: (preselect?: AvailableTool) => void;
  /** Improve with AI (ai-images Q24); when given, the row's Improve becomes the split button. */
  onImproveAi?: () => void;
}

export function SlotRow({
  slot,
  item,
  thumb,
  warnings,
  uploading,
  busy,
  onBusy,
  canPickFromLibrary,
  onFiles,
  onPickFromLibrary,
  onDescribe,
  onCover,
  onMoveToExtra,
  onRemove,
  onKeepAnyway,
  onImprove,
  onImproveAi,
}: SlotRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    // Cleared at once so picking the same file again after a failure still fires a change.
    event.target.value = "";
    if (files.length > 0) onFiles(files);
  };

  if (!item) {
    return (
      <li className="rounded-card border border-dashed border-border p-3">
        <div className="flex gap-3">
          <SlotSilhouette role={slot.role} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-foreground">{slot.label}</p>
            {slot.hint && <p className="text-xs text-muted-foreground">{slot.hint}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {/* A web camera hands back a file, so a file input is the viewfinder (D6): on a phone
              `accept="image/*"` offers the camera or the gallery, on a desktop a file picker. */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => {
              // A tap while another upload runs says to wait rather than being greyed out (A8).
              if (busy) onBusy();
              else inputRef.current?.click();
            }}
            pending={uploading}
          >
            {!uploading && <Icon name="camera" />}
            {uploading ? MEDIA_COPY.rows.uploading : MEDIA_COPY.rows.takeOrChoose}
          </Button>
          {canPickFromLibrary && (
            <Button type="button" variant="outline" size="lg" onClick={onPickFromLibrary}>
              <Icon name="photos" /> {MEDIA_COPY.rows.fromLibrary}
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFiles}
          className="hidden"
          aria-label={MEDIA_COPY.rows.photoFor(slot.label)}
        />
      </li>
    );
  }

  return (
    <li className="space-y-3 rounded-card border border-border p-3">
      <div className="flex gap-3">
        {thumb}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{slot.label}</Badge>
            {item.isThumbnail && <Badge>{MEDIA_COPY.rows.cover}</Badge>}
          </div>
          <Input
            value={item.description ?? ""}
            onChange={(event) => onDescribe(event.target.value)}
            placeholder={MEDIA_COPY.rows.describePhoto}
            aria-label={MEDIA_COPY.rows.describeLabel(slot.label)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!item.isThumbnail && (
          <Button type="button" variant="outline" size="lg" onClick={onCover}>
            <Icon name="rating" /> {MEDIA_COPY.rows.cover}
          </Button>
        )}
        {onImprove && onImproveAi && <ImproveSplitButton onAi={onImproveAi} onTool={(tool) => onImprove(tool)} />}
        {onImprove && !onImproveAi && (
          <Button type="button" variant="outline" size="lg" onClick={() => onImprove()}>
            <ImproveIcon /> {MEDIA_COPY.rows.improveMore}
          </Button>
        )}
        <Button type="button" variant="outline" size="lg" onClick={onMoveToExtra}>
          {MEDIA_COPY.rows.moveToExtra}
        </Button>
        <Button
          type="button"
          variant="outline"
          shape="icon" size="lg"
          onClick={onRemove}
          aria-label={MEDIA_COPY.rows.removeSlotPhoto(slot.label)}
        >
          <Icon name="close" />
        </Button>
      </div>
      {warnings.length > 0 && (
        <CaptureBanner warnings={warnings} onRemove={onRemove} onKeep={onKeepAnyway} onImprove={onImprove} />
      )}
    </li>
  );
}

interface ExtraRowProps {
  item: ProductMediaInput;
  /** Position among the extras, for the move buttons and the labels. */
  index: number;
  thumb: ReactNode;
  /** A hosted video's readiness (video-hosting spec R3, R7); null for a photograph or a link. */
  status?: ProductMediaState | null;
  shotList: ShotList;
  warnings: CaptureWarning[];
  onDescribe: (description: string) => void;
  onCover: () => void;
  onMove: (delta: 1 | -1) => void;
  onAssignSlot: (slotKey: string) => void;
  onRemove: () => void;
  onKeepAnyway: () => void;
  /** Opens the improve sheet, optionally on a tool; a photograph only, since a video has no still to improve. */
  onImprove?: (preselect?: AvailableTool) => void;
  /** Improve with AI (ai-images Q24); when given, the row's Improve becomes the split button. */
  onImproveAi?: () => void;
}

export function ExtraRow({
  item,
  index,
  thumb,
  status = null,
  shotList,
  warnings,
  onDescribe,
  onCover,
  onMove,
  onAssignSlot,
  onRemove,
  onKeepAnyway,
  onImprove,
  onImproveAi,
}: ExtraRowProps) {
  const isVideo = item.kind !== "IMAGE";
  const label = `${isVideo ? "video" : "extra photo"} ${index + 1}`;

  return (
    <li className="space-y-3 rounded-card border border-border p-3">
      <div className="flex gap-3">
        {thumb}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isVideo ? "secondary" : "outline"}>{isVideo ? MEDIA_COPY.rows.video : MEDIA_COPY.rows.extraPhoto}</Badge>
            {item.isThumbnail && <Badge>{MEDIA_COPY.rows.cover}</Badge>}
            {/* A hosted video says where it is (spec R3, R7): a badge on the row, never a modal. */}
            {status === "processing" && <Badge variant="outline">{MEDIA_COPY.rows.processing}</Badge>}
            {status === "failed" && <Badge variant="destructive">{MEDIA_COPY.rows.failed}</Badge>}
          </div>
          {status === "processing" && (
            <p className="text-xs text-muted-foreground">
              {MEDIA_COPY.rows.processingHint}
            </p>
          )}
          {status === "failed" && (
            <p className="text-xs text-muted-foreground">
              {MEDIA_COPY.rows.failedHint}
            </p>
          )}
          {/* Only a photograph fills a slot; a video is always an extra (D4). */}
          {!isVideo && (
            <Select
              value=""
              onChange={(event) => event.target.value && onAssignSlot(event.target.value)}
              aria-label={MEDIA_COPY.rows.moveToSlot(label)}
            >
              <option value="">{MEDIA_COPY.rows.moveToSlotOption}</option>
              {shotList.map((slot) => (
                <option key={slot.key} value={slot.key}>
                  {slot.label}
                </option>
              ))}
            </Select>
          )}
          <Input
            value={item.description ?? ""}
            onChange={(event) => onDescribe(event.target.value)}
            placeholder={MEDIA_COPY.rows.describePlaceholder}
            aria-label={MEDIA_COPY.rows.describeLabel(label)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          shape="icon" size="lg"
          // moveExtra is a no-op at the ends, so the button need not be greyed (A8).
          onClick={() => onMove(-1)}
          aria-label={MEDIA_COPY.rows.moveEarlier(label)}
        >
          <Icon name="move-up" />
        </Button>
        <Button
          type="button"
          variant="outline"
          shape="icon" size="lg"
          onClick={() => onMove(1)}
          aria-label={MEDIA_COPY.rows.moveLater(label)}
        >
          <Icon name="move-down" />
        </Button>
        {/* Only a photograph can be the cover — the option is absent on a video rather than
            present and rejected. */}
        {!isVideo && !item.isThumbnail && (
          <Button type="button" variant="outline" size="lg" onClick={onCover}>
            <Icon name="rating" /> {MEDIA_COPY.rows.cover}
          </Button>
        )}
        {!isVideo && onImprove && onImproveAi && <ImproveSplitButton onAi={onImproveAi} onTool={(tool) => onImprove(tool)} />}
        {!isVideo && onImprove && !onImproveAi && (
          <Button type="button" variant="outline" size="lg" onClick={() => onImprove()}>
            <ImproveIcon /> {MEDIA_COPY.rows.improveMore}
          </Button>
        )}
        <Button type="button" variant="outline" shape="icon" size="lg" onClick={onRemove} aria-label={MEDIA_COPY.rows.removeNamed(label)}>
          <Icon name="close" />
        </Button>
      </div>
      {warnings.length > 0 && (
        <CaptureBanner warnings={warnings} onRemove={onRemove} onKeep={onKeepAnyway} onImprove={onImprove} />
      )}
    </li>
  );
}

/** Improve's mark: a lock while Image enhancement is off, so the button says it before the tap (feature-access Q20). */
function ImproveIcon() {
  const { features } = useShopPlan();
  return <Icon name={features.imageEnhancement ? "enhance" : "lock"} />;
}
