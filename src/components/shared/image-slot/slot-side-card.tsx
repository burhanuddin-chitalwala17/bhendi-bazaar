"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { IMAGE_FIT, isOffShape, ratioOf, type ImageFit, type SlotShape } from "@server/catalog/image-slots";
import type { ImageSlotSideValue } from "@server/catalog/image-framing";
import { sampleEdgeColour } from "./measure";
import { SlotPreview } from "./slot-preview";
import { useSlotUpload } from "./useSlotUpload";
import { SLOT_SIDE_CARD_COPY } from "./image-slot-copy";

/** How the picture sits against the slot's shape, in words: the first thing the card says. */
function shapeNote(side: ImageSlotSideValue, shape: SlotShape): string | null {
  if (!side.width || !side.height || !isOffShape(side.width, side.height, shape)) return null;
  const taller = side.width / side.height < ratioOf(shape);
  return `${taller ? "Taller" : "Wider"} than ${shape.label}. Choose how to handle it.`;
}

const FALLBACK_FILL = "#ffffff";

/**
 * One form factor of a slot (ux: the Desktop and Phone cards): upload, replace, remove, and — when
 * the picture is off the slot's shape — the choice between Keep it exact and Fit it in.
 */
export function SlotSideCard({
  title,
  badge,
  shape,
  value,
  onChange,
  onCrop,
  upload,
  uploadLabel,
  emptyHint,
}: {
  title: string;
  badge: string;
  shape: SlotShape;
  value: ImageSlotSideValue | null;
  onChange: (value: ImageSlotSideValue | null) => void;
  /** Opens Keep it exact on this card's picture. */
  onCrop: () => void;
  upload: (file: File) => Promise<string>;
  uploadLabel: string;
  emptyHint?: React.ReactNode;
}) {
  const input = useRef<HTMLInputElement>(null);
  const slot = useSlotUpload(shape, upload);
  const note = value ? shapeNote(value, shape) : null;
  const choosable = Boolean(note) || value?.fit === IMAGE_FIT.CONTAIN;

  const choose = async (fit: ImageFit) => {
    if (!value) return;
    if (fit === IMAGE_FIT.CROP) {
      onChange({ ...value, fit, fill: null });
      onCrop();
      return;
    }
    onChange({ ...value, fit, fill: value.fill ?? (await sampleEdgeColour(value.url)) ?? FALLBACK_FILL });
  };

  return (
    <section className="space-y-3 rounded-card border border-border p-3" aria-label={title}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-title">{title}</h3>
        <span className="text-caption text-muted-foreground">{value ? "Uploaded" : badge}</span>
      </header>

      {value ? (
        <>
          <SlotPreview
            side={{
              src: value.url,
              fit: value.fit,
              position: { x: 0.5, y: 0.5 },
              fill: value.fill,
            }}
            aspect={value.width && value.height ? value.width / value.height : ratioOf(shape)}
            sizes="(min-width: 768px) 24rem, 100vw"
          />
          {value.width && value.height && (
            <p className="text-caption text-muted-foreground">
              {value.width} × {value.height}
            </p>
          )}
          {note && <p className="text-small">{note}</p>}
          {choosable && (
            <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={SLOT_SIDE_CARD_COPY.howToFitIt}>
              <Button
                type="button"
                variant={value.fit === IMAGE_FIT.CROP ? "default" : "outline"}
                aria-pressed={value.fit === IMAGE_FIT.CROP}
                className="h-auto flex-col items-start justify-start whitespace-normal py-3 text-left"
                onClick={() => void choose(IMAGE_FIT.CROP)}
              >
                <span className="font-medium">{SLOT_SIDE_CARD_COPY.keepItExact}</span>
                <span className="text-caption">Crop to {shape.label}. Drag to choose what stays.</span>
              </Button>
              <Button
                type="button"
                variant={value.fit === IMAGE_FIT.CONTAIN ? "default" : "outline"}
                aria-pressed={value.fit === IMAGE_FIT.CONTAIN}
                className="h-auto flex-col items-start justify-start whitespace-normal py-3 text-left"
                onClick={() => void choose(IMAGE_FIT.CONTAIN)}
              >
                <span className="font-medium">{SLOT_SIDE_CARD_COPY.fitItIn}</span>
                <span className="text-caption">{SLOT_SIDE_CARD_COPY.fitItInHint}</span>
              </Button>
            </div>
          )}
          {value.fit === IMAGE_FIT.CONTAIN && (
            <label className="flex items-center gap-3 text-small">
              {SLOT_SIDE_CARD_COPY.edgeColour}
              <Input
                type="color"
                className="h-10 w-16 p-1"
                value={value.fill ?? FALLBACK_FILL}
                onChange={(event) => onChange({ ...value, fill: event.target.value })}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {value.fit === IMAGE_FIT.CROP && note && (
              <Button type="button" variant="outline" size="sm" onClick={onCrop}>
                <Icon name="crop" />
                {SLOT_SIDE_CARD_COPY.changeCrop}
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" pending={slot.uploading} onClick={() => input.current?.click()}>
              <Icon name="upload" />
              {SLOT_SIDE_CARD_COPY.replace}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Icon name="delete" />
              {SLOT_SIDE_CARD_COPY.remove}
            </Button>
          </div>
        </>
      ) : (
        <>
          {emptyHint}
          <Button type="button" variant="outline" className="min-h-11 w-full sm:w-auto" pending={slot.uploading} onClick={() => input.current?.click()}>
            <Icon name="upload" />
            {uploadLabel}
          </Button>
        </>
      )}

      {slot.notice && <p className="text-small text-warning">{slot.notice}</p>}
      {slot.error && (
        <p role="alert" className="text-small text-destructive">
          {slot.error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          const uploaded = await slot.run(file);
          if (uploaded) onChange(uploaded);
        }}
      />
    </section>
  );
}
