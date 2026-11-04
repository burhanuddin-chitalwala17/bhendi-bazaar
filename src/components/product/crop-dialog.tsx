"use client";

import { useState } from "react";
import Cropper, {
  type Area,
  type MediaSize,
  type Point,
} from "react-easy-crop";
// The library ships its stylesheet rather than injecting one: without it the frame has no bounds
// and the picture is laid out by the page's own image reset, which is to say not shown at all.
import "react-easy-crop/react-easy-crop.css";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import {
  CROP_ASPECTS,
  aspectRatioOf,
  isIdentityTransform,
  normaliseTransform,
  rotateBy,
  rotatedBounds,
  type CropAspect,
  type CropRotation,
  type CropTransform,
} from "@/lib/image/crop-transform";

/** One photo waiting to be framed. The id is what tells two picks of the same file apart. */
export interface CropCandidate {
  id: string;
  /**
   * The picture to show, already reduced to what will be stored, so the rectangle is measured on
   * the source (trd D6a). The queue owns it: it is made when the photo joins and released when it
   * leaves, which is the only lifetime a remount cannot cut short.
   */
  src: string;
}

interface CropDialogProps {
  /** The photo on the table; null closes the sheet. */
  photo: CropCandidate | null;
  /** How many wait behind it — a multi-file pick is framed one photo at a time. */
  remaining: number;
  /** An upload is in flight for this photo: the actions wait, and the sheet cannot be dismissed. */
  busy: boolean;
  /**
   * False when the picture is already stored and this is a reframe: keeping it as it is means
   * doing nothing, so the two "as is" actions are absent and an untouched frame simply cannot be
   * applied (media-library R8a).
   */
  canUseAsIs?: boolean;
  onUseAsIs: () => void;
  onUseCrop: (transform: CropTransform) => void;
  onUseAllAsIs: () => void;
  onCancel: () => void;
}

const PRESETS = Object.values(CROP_ASPECTS);
const labelOf = (aspect: CropAspect) =>
  aspect === CROP_ASPECTS.FREE ? "Free" : aspect;

/**
 * Rotate and crop before the upload is spent (media-library R8a): aspect presets, quarter turns,
 * pinch or scroll zoom, and nothing that touches colour — a filter misrepresents a product on a
 * marketplace. "Use as is" is the untouched photo, exactly what a pick did before this existed.
 */
export function CropDialog({
  photo,
  remaining,
  busy,
  canUseAsIs = true,
  onUseAsIs,
  onUseCrop,
  onUseAllAsIs,
  onCancel,
}: CropDialogProps) {
  return (
    <TaskDialog
      open={photo !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
      title="Frame this photo"
      description={
        !canUseAsIs
          ? "Turn and frame it. The photo you started from is kept as it is."
          : remaining > 0
            ? `${remaining} more after this one. Turn and frame it, or use it as it is.`
            : "Turn and frame it, or use it as it is. Colours are never changed."
      }
    >
      {/* Keyed by the candidate so each photo starts unframed: a turn chosen for one is rarely
            right for the next, and a remount is how React resets that without effects. */}
      {photo && (
        <CropFrame
          key={photo.id}
          src={photo.src}
          remaining={remaining}
          busy={busy}
          canUseAsIs={canUseAsIs}
          onUseAsIs={onUseAsIs}
          onUseCrop={onUseCrop}
          onUseAllAsIs={onUseAllAsIs}
        />
      )}
    </TaskDialog>
  );
}

function CropFrame({
  src,
  remaining,
  busy,
  canUseAsIs = true,
  onUseAsIs,
  onUseCrop,
  onUseAllAsIs,
}: Omit<CropDialogProps, "photo" | "onCancel"> & { src: string }) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<CropRotation>(0);
  const [aspect, setAspect] = useState<CropAspect>(CROP_ASPECTS.SQUARE);
  const [natural, setNatural] = useState<MediaSize | null>(null);
  const [area, setArea] = useState<Area | null>(null);

  // Free is the picture's own shape, turned as it is turned: the box then fills the frame and
  // zoom alone decides what is kept.
  const own = natural
    ? rotatedBounds(natural.naturalWidth, natural.naturalHeight, rotation)
    : null;
  const ratio = aspectRatioOf(aspect) ?? (own ? own.width / own.height : 1);

  const transform =
    area && natural
      ? normaliseTransform(area, rotation, natural.naturalWidth, natural.naturalHeight)
      : null;
  // The whole picture, unturned, is not a crop. On an upload it means the original is used; on a
  // reframe it means nothing to do, so the action waits until the frame has actually moved.
  const isUntouched = Boolean(
    transform && natural && isIdentityTransform(transform, natural.naturalWidth, natural.naturalHeight),
  );

  // Nothing here is disabled (owner rule, ADR-0053): while an upload runs a tap is ignored and the
  // spinner says why; an untouched reframe says there is nothing to apply.
  const [hint, setHint] = useState<string | null>(null);
  const whenFree = (action: () => void) => () => {
    if (busy) return;
    setHint(null);
    action();
  };
  const applyCrop = whenFree(() => {
    if (!transform) {
      setHint("Wait for the photo to load");
      return;
    }
    if (isUntouched && canUseAsIs) onUseAsIs();
    else if (isUntouched) setHint("Turn or move the frame first");
    else onUseCrop(transform);
  });

  return (
    <>
      <div
        className="flex shrink-0 flex-wrap gap-2"
        role="group"
        aria-label="Shape"
      >
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant={preset === aspect ? "default" : "outline"}
            aria-pressed={preset === aspect}
            onClick={whenFree(() => setAspect(preset))}
          >
            {labelOf(preset)}
          </Button>
        ))}
      </div>

      {/* The frame takes the room the dialog has left rather than a shape of its own: a square
          canvas on a wide picture is either a scrollbar or a letterbox, and it was the scrollbar. */}
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-card bg-muted">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={ratio}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_, pixels) => setArea(pixels)}
          onMediaLoaded={setNatural}
          showGrid
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            shape="icon" size="lg"
            aria-label="Rotate left"
            onClick={whenFree(() => setRotation((current) => rotateBy(current, -90)))}
          >
            {/* No counter-clockwise drawing in the registry; the clockwise one, mirrored. */}
            <Icon name="rotate" className="-scale-x-100" />
          </Button>
          <Button
            type="button"
            variant="outline"
            shape="icon" size="lg"
            aria-label="Rotate right"
            onClick={whenFree(() => setRotation((current) => rotateBy(current, 90)))}
          >
            <Icon name="rotate" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground" role={hint ? "status" : undefined}>
          {hint ?? "Pinch or scroll to zoom, drag to move."}
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
        {canUseAsIs && remaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={whenFree(onUseAllAsIs)}
            aria-busy={busy}
          >
            Use all as is
          </Button>
        )}
        {canUseAsIs && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={whenFree(onUseAsIs)}
            aria-busy={busy}
          >
            Use as is
          </Button>
        )}
        <Button
          type="button"
          size="lg"
          onClick={applyCrop}
          pending={busy}
        >
          {!busy && <Icon name="done" />}
          {busy ? "Uploading…" : "Use this crop"}
        </Button>
      </div>
    </>
  );
}
