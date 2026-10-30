"use client";

import { useRef, type ChangeEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Camera, Images, Loader2, Sparkles, Star, TriangleAlert, X } from "lucide-react";
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
      <TriangleAlert aria-hidden />
      <AlertTitle className="text-warning">Worth another look</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4 text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning.check}>{warning.message}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          {fix && onImprove && (
            <Button type="button" size="lg" onClick={() => onImprove(fix)}>
              <Sparkles /> Improve
            </Button>
          )}
          <Button type="button" variant="outline" size="lg" onClick={onRemove}>
            <X /> Remove
          </Button>
          <Button type="button" variant="ghost" size="lg" onClick={onKeep}>
            Keep anyway
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
            aria-busy={uploading}
          >
            {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
            {uploading ? "Uploading…" : "Take or choose a photo"}
          </Button>
          {canPickFromLibrary && (
            <Button type="button" variant="outline" size="lg" onClick={onPickFromLibrary}>
              <Images /> From library
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFiles}
          className="hidden"
          aria-label={`Photo for ${slot.label}`}
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
            {item.isThumbnail && <Badge>Cover</Badge>}
          </div>
          <Input
            value={item.description ?? ""}
            onChange={(event) => onDescribe(event.target.value)}
            placeholder="Describe this photo"
            aria-label={`Description for ${slot.label}`}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {!item.isThumbnail && (
          <Button type="button" variant="outline" size="lg" onClick={onCover}>
            <Star /> Cover
          </Button>
        )}
        {onImprove && (
          <Button type="button" variant="outline" size="lg" onClick={() => onImprove()}>
            <Sparkles /> Improve…
          </Button>
        )}
        <Button type="button" variant="outline" size="lg" onClick={onMoveToExtra}>
          Move to extra
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={onRemove}
          aria-label={`Remove the ${slot.label} photo`}
        >
          <X />
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
}: ExtraRowProps) {
  const isVideo = item.kind !== "IMAGE";
  const label = `${isVideo ? "video" : "extra photo"} ${index + 1}`;

  return (
    <li className="space-y-3 rounded-card border border-border p-3">
      <div className="flex gap-3">
        {thumb}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isVideo ? "secondary" : "outline"}>{isVideo ? "Video" : "Extra photo"}</Badge>
            {item.isThumbnail && <Badge>Cover</Badge>}
            {/* A hosted video says where it is (spec R3, R7): a badge on the row, never a modal. */}
            {status === "processing" && <Badge variant="outline">Processing</Badge>}
            {status === "failed" && <Badge variant="destructive">Failed</Badge>}
          </div>
          {status === "processing" && (
            <p className="text-xs text-muted-foreground">
              Being made playable in the background. Save whenever you like; it plays on the product page once ready.
            </p>
          )}
          {status === "failed" && (
            <p className="text-xs text-muted-foreground">
              Could not be made playable — the reason is on this video in your library. Remove it here.
            </p>
          )}
          {/* Only a photograph fills a slot; a video is always an extra (D4). */}
          {!isVideo && (
            <Select
              value=""
              onChange={(event) => event.target.value && onAssignSlot(event.target.value)}
              aria-label={`Move ${label} to a slot`}
            >
              <option value="">Move to a slot…</option>
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
            placeholder="Describe this item"
            aria-label={`Description for ${label}`}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          // moveExtra is a no-op at the ends, so the button need not be greyed (A8).
          onClick={() => onMove(-1)}
          aria-label={`Move ${label} earlier`}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={() => onMove(1)}
          aria-label={`Move ${label} later`}
        >
          <ArrowDown />
        </Button>
        {/* Only a photograph can be the cover — the option is absent on a video rather than
            present and rejected. */}
        {!isVideo && !item.isThumbnail && (
          <Button type="button" variant="outline" size="lg" onClick={onCover}>
            <Star /> Cover
          </Button>
        )}
        {!isVideo && onImprove && (
          <Button type="button" variant="outline" size="lg" onClick={() => onImprove()}>
            <Sparkles /> Improve…
          </Button>
        )}
        <Button type="button" variant="outline" size="icon-lg" onClick={onRemove} aria-label={`Remove ${label}`}>
          <X />
        </Button>
      </div>
      {warnings.length > 0 && (
        <CaptureBanner warnings={warnings} onRemove={onRemove} onKeep={onKeepAnyway} onImprove={onImprove} />
      )}
    </li>
  );
}
