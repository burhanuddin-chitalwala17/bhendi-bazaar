"use client";

import { useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import type { FractionRect } from "@server/catalog/image-slots";
import { optimizedUrl } from "./measure";

/** Wide enough to frame by eye; fractions survive any width (trd D4). */
const FRAME_SOURCE_WIDTH = 1200;

/**
 * Keep it exact (image-slots R3): the slot's shape, locked, slid over the picture. No zoom and no
 * turn — the picture is only a little off, and a frame that spans one whole axis is what CSS can
 * reproduce exactly (trd D3). Same library and surface as the product photo crop (`CropDialog`).
 */
export function SlotCropDialog({
  src,
  aspect,
  shapeLabel,
  initial,
  onUse,
  onCancel,
}: {
  /** The stored picture; null closes the dialog. */
  src: string | null;
  aspect: number;
  shapeLabel: string;
  initial: FractionRect | null;
  onUse: (frame: FractionRect) => void;
  onCancel: () => void;
}) {
  return (
    <TaskDialog
      open={src !== null}
      onOpenChange={(open) => !open && onCancel()}
      title="Keep it exact"
      description={`Crop to ${shapeLabel}. Drag to choose what stays.`}
    >
      {src && <Frame key={src} src={src} aspect={aspect} initial={initial} onUse={onUse} />}
    </TaskDialog>
  );
}

function Frame({
  src,
  aspect,
  initial,
  onUse,
}: {
  src: string;
  aspect: number;
  initial: FractionRect | null;
  onUse: (frame: FractionRect) => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [area, setArea] = useState<Area | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  return (
    <>
      <div className="relative min-h-0 w-full flex-1 overflow-hidden rounded-card bg-muted">
        <Cropper
          image={optimizedUrl(src, FRAME_SOURCE_WIDTH)}
          crop={crop}
          zoom={1}
          minZoom={1}
          maxZoom={1}
          zoomWithScroll={false}
          aspect={aspect}
          onCropChange={setCrop}
          onCropComplete={(percentages) => setArea(percentages)}
          initialCroppedAreaPercentages={
            initial
              ? { x: initial.x * 100, y: initial.y * 100, width: initial.width * 100, height: initial.height * 100 }
              : undefined
          }
          showGrid
        />
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-small text-muted-foreground" role={hint ? "status" : undefined}>
          {hint ?? "Drag the picture to choose what stays."}
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => {
            if (!area) return setHint("Wait for the picture to load");
            onUse({ x: area.x / 100, y: area.y / 100, width: area.width / 100, height: area.height / 100 });
          }}
        >
          <Icon name="done" />
          Use this crop
        </Button>
      </div>
    </>
  );
}
