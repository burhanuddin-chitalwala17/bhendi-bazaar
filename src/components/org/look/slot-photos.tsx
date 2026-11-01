"use client";

import { useEffect, useId, useRef } from "react";
import NextImage from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SECTION_COPY } from "./section-copy";
import { usePhotoUploads } from "./usePhotoUploads";

/**
 * A section's photos (ux.md section sheet): thumbnails in order, remove, add. Past the limit the
 * add button stays and says so on tap rather than going grey (owner rule: never disable a button).
 */
export function SlotPhotos({
  orgId,
  value,
  onChange,
  max,
  label,
}: {
  orgId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max: number;
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  // An upload finishes after renders the user caused meanwhile (a removal): append to what is there then.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const photos = usePhotoUploads(orgId, (urls) => onChange([...latest.current, ...urls].slice(0, max)));
  const full = value.length >= max;

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {value.map((url, index) => (
          <li key={url} className="relative size-20 overflow-hidden rounded-field border border-border bg-muted">
            <NextImage src={url} alt="" fill sizes="80px" className="object-cover" />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label={`${SECTION_COPY.removePhoto} ${index + 1}`}
              className="absolute right-1 top-1 size-7"
              onClick={() => onChange(value.filter((u) => u !== url))}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
        {photos.uploading > 0 && (
          <li className="flex size-20 flex-col items-center justify-center gap-1 rounded-field border border-dashed border-border text-2xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {SECTION_COPY.uploading}
          </li>
        )}
      </ul>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        aria-describedby={full ? `${id}-full` : undefined}
        onClick={() => (full ? input.current?.blur() : input.current?.click())}
      >
        <ImagePlus aria-hidden />
        {SECTION_COPY.addPhotoButton}
      </Button>
      {full && (
        <p id={`${id}-full`} className="text-sm text-muted-foreground">
          {max === 1 ? "One photo here. Remove it to add another." : `Up to ${max} photos. Remove one to add another.`}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, max - value.length));
          event.target.value = "";
          void photos.upload(files);
        }}
      />
      {photos.refused && <p role="alert" className="text-sm text-destructive">{photos.refused}</p>}
      {photos.failedCount > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
          {SECTION_COPY.notUploaded(photos.failedCount)}
          <Button type="button" size="sm" variant="outline" onClick={() => void photos.retry()}>
            {SECTION_COPY.tryAgain}
          </Button>
        </div>
      )}
    </div>
  );
}
