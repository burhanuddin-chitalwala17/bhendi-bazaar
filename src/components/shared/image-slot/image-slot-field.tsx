"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  CENTRE,
  FORM_FACTOR,
  IMAGE_SLOTS,
  ratioOf,
  type FocusPoint,
  type FormFactor,
  type ImageSlotKey,
} from "@server/catalog/image-slots";
import { previewOf, type ImageSlotSideValue, type ImageSlotValue } from "@server/catalog/image-framing";
import { SlotCropDialog } from "./slot-crop-dialog";
import { SlotPreview } from "./slot-preview";
import { SlotSideCard } from "./slot-side-card";
import { IMAGE_SLOT_FIELD_COPY } from "./image-slot-copy";
import { IMAGE_SLOT_FIELD_LABEL_COPY } from "@/components/shared/image-slot/image-slot-copy";

const STEP = 0.05;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The one picture field for every slot (image-slots spec R2–R5): a desktop and a phone version,
 * each optional, cropped or fitted to the shape the slot declares, a focus point for phones when
 * there is no phone version, and the result at three widths before saving. Uploading is the
 * caller's (`upload`), since whose library it lands in is theirs to know.
 */
export function ImageSlotField({
  slot,
  label,
  value,
  onChange,
  upload,
  error,
  showPreview = true,
}: {
  slot: ImageSlotKey;
  label: string;
  value: ImageSlotValue | null;
  onChange: (value: ImageSlotValue | null) => void;
  upload: (file: File) => Promise<string>;
  /** The server's verdict on this field (R7), shown under it. */
  error?: string;
  /** False when the caller draws its own preview of what the picture goes into (the banner drawer). */
  showPreview?: boolean;
}) {
  const shapes = IMAGE_SLOTS[slot];
  const [cropping, setCropping] = useState<FormFactor | null>(null);
  const current: ImageSlotValue = value ?? { desktop: null, phone: null, phoneFocus: CENTRE };

  const setSide = (formFactor: FormFactor, side: ImageSlotSideValue | null) => {
    const next = { ...current, [formFactor]: side };
    onChange(next.desktop || next.phone ? next : null);
  };
  const setFocus = (phoneFocus: FocusPoint) => onChange({ ...current, phoneFocus });

  const croppingSide = cropping ? current[cropping] : null;
  const preview = previewOf(value);

  return (
    <fieldset className="space-y-4">
      <legend className="text-label uppercase text-muted-foreground">{label}</legend>
      <p className="text-small text-muted-foreground">
        {IMAGE_SLOT_FIELD_COPY.uploadOneOrBothIf}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <SlotSideCard
          title={`Desktop · ${shapes.desktop.label}`}
          badge="Recommended"
          shape={shapes.desktop}
          value={current.desktop}
          onChange={(side) => setSide(FORM_FACTOR.DESKTOP, side)}
          onCrop={() => setCropping(FORM_FACTOR.DESKTOP)}
          upload={upload}
          uploadLabel={IMAGE_SLOT_FIELD_LABEL_COPY.desktop}
        />
        <SlotSideCard
          title={`Phone · ${shapes.phone.label}`}
          badge="Optional"
          shape={shapes.phone}
          value={current.phone}
          onChange={(side) => setSide(FORM_FACTOR.PHONE, side)}
          onCrop={() => setCropping(FORM_FACTOR.PHONE)}
          upload={upload}
          uploadLabel={IMAGE_SLOT_FIELD_LABEL_COPY.phone}
          emptyHint={
            current.desktop && (
              <FocusPicker
                src={current.desktop.url}
                aspect={current.desktop.width && current.desktop.height ? current.desktop.width / current.desktop.height : ratioOf(shapes.desktop)}
                shapeLabel={shapes.phone.label}
                value={current.phoneFocus}
                onChange={setFocus}
              />
            )
          }
        />
      </div>

      {showPreview && preview && (
        <section aria-label={IMAGE_SLOT_FIELD_COPY.previewBeforeYouSave} className="space-y-2">
          <h3 className="text-label uppercase text-muted-foreground">{IMAGE_SLOT_FIELD_COPY.previewBeforeYouSave}</h3>
          <div className="grid grid-cols-3 items-end gap-3">
            <figure className="space-y-1">
              <SlotPreview side={preview.desktop} aspect={ratioOf(shapes.desktop)} sizes="(min-width: 768px) 16rem, 33vw" />
              <figcaption className="text-caption text-muted-foreground">{IMAGE_SLOT_FIELD_COPY.desktop1280Wide}</figcaption>
            </figure>
            <figure className="space-y-1">
              <SlotPreview side={preview.desktop} aspect={ratioOf(shapes.desktop)} sizes="(min-width: 768px) 12rem, 33vw" />
              <figcaption className="text-caption text-muted-foreground">{IMAGE_SLOT_FIELD_COPY.tablet834Wide}</figcaption>
            </figure>
            <figure className="mx-auto w-2/3 space-y-1">
              <SlotPreview side={preview.phone} aspect={ratioOf(shapes.phone)} sizes="(min-width: 768px) 8rem, 22vw" />
              <figcaption className="text-caption text-muted-foreground">{IMAGE_SLOT_FIELD_COPY.phone390Wide}</figcaption>
            </figure>
          </div>
        </section>
      )}

      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}

      <SlotCropDialog
        src={croppingSide?.url ?? null}
        aspect={cropping ? ratioOf(shapes[cropping]) : 1}
        shapeLabel={cropping ? shapes[cropping].label : ""}
        initial={croppingSide?.crop ?? null}
        onCancel={() => setCropping(null)}
        onUse={(frame) => {
          if (cropping && croppingSide) setSide(cropping, { ...croppingSide, crop: frame });
          setCropping(null);
        }}
      />
    </fieldset>
  );
}

/**
 * Where phones centre the desktop picture until a phone version exists (spec R4). A tap places the
 * point; arrow keys move it, so it does not need a pointer.
 */
function FocusPicker({
  src,
  aspect,
  shapeLabel,
  value,
  onChange,
}: {
  src: string;
  aspect: number;
  shapeLabel: string;
  value: FocusPoint;
  onChange: (point: FocusPoint) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-small text-muted-foreground">
        Until you add one, phones show the desktop picture cropped to {shapeLabel} around the point you pick.
      </p>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Focus point, ${Math.round(value.x * 100)}% across and ${Math.round(value.y * 100)}% down. Tap the picture or use the arrow keys.`}
        className="relative block h-auto w-full overflow-hidden rounded-field border border-border p-0"
        style={{ aspectRatio: `${aspect}` }}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          onChange({ x: clamp01((event.clientX - box.left) / box.width), y: clamp01((event.clientY - box.top) / box.height) });
        }}
        onKeyDown={(event) => {
          const moves: Record<string, FocusPoint> = {
            ArrowLeft: { x: value.x - STEP, y: value.y },
            ArrowRight: { x: value.x + STEP, y: value.y },
            ArrowUp: { x: value.x, y: value.y - STEP },
            ArrowDown: { x: value.x, y: value.y + STEP },
          };
          const next = moves[event.key];
          if (!next) return;
          event.preventDefault();
          onChange({ x: clamp01(next.x), y: clamp01(next.y) });
        }}
      >
        <Image src={src} alt="" fill sizes="(min-width: 768px) 24rem, 100vw" className="object-cover" />
        <span
          aria-hidden
          className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-raised"
          style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
        />
      </Button>
      <p className="text-caption text-muted-foreground">{IMAGE_SLOT_FIELD_COPY.pickTheFocusPoint}</p>
    </div>
  );
}
