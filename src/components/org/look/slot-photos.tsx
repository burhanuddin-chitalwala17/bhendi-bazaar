"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ImageSlotField } from "@/components/shared/image-slot/image-slot-field";
import { uploadApiClient } from "@/components/shared/uploadApiClient";
import type { ImageSlotKey } from "@server/catalog/image-slots";
import type { ImageSlotValue } from "@server/catalog/image-framing";
import { SECTION_COPY } from "./section-copy";

/** Uploads land in this shop's library: the only pictures its storefront may use (image-slots D7). */
export function shopUpload(orgId: string) {
  return async (file: File) => {
    const [url] = await uploadApiClient.uploadFiles(`/api/org/${orgId}/upload`, "products", [file]);
    return url;
  };
}

/**
 * A section's photos as picture sets (image-slots D10): each a desktop and a phone version at the
 * slot's shape, in order, with Remove. An empty set is a photo being added. Past the limit, Add
 * stays and says so on tap rather than going grey (owner rule: never disable a button).
 */
export function SlotPhotos({
  orgId,
  slot,
  value,
  onChange,
  max,
  label,
  error,
}: {
  orgId: string;
  slot: ImageSlotKey;
  value: ImageSlotValue[];
  onChange: (images: ImageSlotValue[]) => void;
  max: number;
  label: string;
  error?: string;
}) {
  const id = useId();
  // A set being filled in has no picture yet, so it lives here until it has one.
  const [adding, setAdding] = useState(false);
  const [full, setFull] = useState(false);
  const upload = shopUpload(orgId);

  return (
    <div className="space-y-4">
      <ol className="space-y-4" aria-label={label}>
        {value.map((image, index) => (
          <li key={index} className="space-y-2 rounded-card border border-border p-3">
            <ImageSlotField
              slot={slot}
              label={`${SECTION_COPY.photo} ${index + 1}`}
              value={image}
              onChange={(next) => onChange(next ? value.map((v, i) => (i === index ? next : v)) : value.filter((_, i) => i !== index))}
              upload={upload}
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              <Icon name="delete" size="sm" />
              {`${SECTION_COPY.removePhoto} ${index + 1}`}
            </Button>
          </li>
        ))}
        {adding && (
          <li className="rounded-card border border-dashed border-border p-3">
            <ImageSlotField
              slot={slot}
              label={`${SECTION_COPY.photo} ${value.length + 1}`}
              value={null}
              onChange={(next) => {
                if (!next) return;
                setAdding(false);
                onChange([...value, next]);
              }}
              upload={upload}
            />
          </li>
        )}
      </ol>
      {!adding && (
        <Button
          type="button"
          variant="outline"
          aria-describedby={full ? `${id}-full` : undefined}
          onClick={() => (value.length >= max ? setFull(true) : setAdding(true))}
        >
          <Icon name="add-photo" size="sm" />
          {SECTION_COPY.addPhotoButton}
        </Button>
      )}
      {full && value.length >= max && (
        <p id={`${id}-full`} className="text-small text-muted-foreground">
          {max === 1 ? "One photo here. Remove it to add another." : `Up to ${max} photos. Remove one to add another.`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
