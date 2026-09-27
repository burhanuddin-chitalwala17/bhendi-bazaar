"use client";

import { useEffect, useState } from "react";
import Cropper, {
  type Area,
  type MediaSize,
  type Point,
} from "react-easy-crop";
// The library ships its stylesheet rather than injecting one: without it the frame has no bounds
// and the picture is laid out by the page's own image reset, which is to say not shown at all.
import "react-easy-crop/react-easy-crop.css";
import { Check, Loader2, RotateCcw, RotateCw } from "lucide-react";
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
  /** Already reduced to what will be stored, so the rectangle is measured on the source (trd D6a). */
  file: File;
}

interface CropDialogProps {
  /** The photo on the table; null closes the sheet. */
  photo: CropCandidate | null;
  /** How many wait behind it — a multi-file pick is framed one photo at a time. */
  remaining: number;
  /** An upload is in flight for this photo: the actions wait, and the sheet cannot be dismissed. */
  busy: boolean;
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
        remaining > 0
          ? `${remaining} more after this one. Turn and frame it, or use it as it is.`
          : "Turn and frame it, or use it as it is. Colours are never changed."
      }
    >
      {/* Keyed by the candidate so each photo starts unframed: a turn chosen for one is rarely
            right for the next, and a remount is how React resets that without effects. */}
      {photo && (
        <CropFrame
          key={photo.id}
          file={photo.file}
          remaining={remaining}
          busy={busy}
          onUseAsIs={onUseAsIs}
          onUseCrop={onUseCrop}
          onUseAllAsIs={onUseAllAsIs}
        />
      )}
    </TaskDialog>
  );
}

function CropFrame({
  file,
  remaining,
  busy,
  onUseAsIs,
  onUseCrop,
  onUseAllAsIs,
}: Omit<CropDialogProps, "photo" | "onCancel"> & { file: File }) {
  // One object URL for the life of this frame; the file is already in the page, so showing it
  // costs no egress (ADR-0026).
  const [src] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

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

  const applyCrop = () => {
    if (!area || !natural) return;
    const transform = normaliseTransform(
      area,
      rotation,
      natural.naturalWidth,
      natural.naturalHeight,
    );
    // The whole picture, unturned, is not a crop: nothing is derived, the original is used.
    if (
      isIdentityTransform(
        transform,
        natural.naturalWidth,
        natural.naturalHeight,
      )
    )
      onUseAsIs();
    else onUseCrop(transform);
  };

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
            onClick={() => setAspect(preset)}
            disabled={busy}
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
            size="icon-lg"
            aria-label="Rotate left"
            onClick={() => setRotation((current) => rotateBy(current, -90))}
            disabled={busy}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            aria-label="Rotate right"
            onClick={() => setRotation((current) => rotateBy(current, 90))}
            disabled={busy}
          >
            <RotateCw />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Pinch or scroll to zoom, drag to move.
        </p>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:justify-end">
        {remaining > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={onUseAllAsIs}
            disabled={busy}
          >
            Use all as is
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onUseAsIs}
          disabled={busy}
        >
          Use as is
        </Button>
        <Button
          type="button"
          size="lg"
          onClick={applyCrop}
          disabled={busy || !area || !natural}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Check />}
          Use this crop
        </Button>
      </div>
    </>
  );
}
