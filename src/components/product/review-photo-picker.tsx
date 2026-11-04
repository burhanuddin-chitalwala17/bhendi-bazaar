"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { downscaleImage, storedPathFor } from "@/lib/image/downscale";
import { uploadDirect } from "@/lib/image/upload-direct";
import { MAX_REVIEW_PHOTOS } from "@server/catalog/media";

/**
 * Photographs on a review, chosen on a phone (review-media R1–R4).
 *
 * The same path an org's photograph takes: reduced here on a canvas against
 * `MAX_IMAGE_EDGE`, then written straight to the object store with a presigned PUT. These
 * bytes never pass through a function — which is the point, since a request body through
 * one is capped at 4.5MB and a phone photograph is usually larger — and it is also why
 * the reduction has to happen here, where the server's `sharp` cannot reach it (ADR-0026).
 *
 * A failed upload takes nothing with it: the file is dropped, the message says so, and
 * every other photograph and every word the reviewer typed stays (R3).
 */
export function ReviewPhotoPicker({
  photos,
  onChange,
  disabled,
}: {
  /** Object URLs already uploaded — the value the form submits. */
  photos: string[];
  onChange: (photos: string[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const room = MAX_REVIEW_PHOTOS - photos.length;

  const add = async (files: FileList) => {
    const chosen = Array.from(files).slice(0, room);
    if (chosen.length < files.length) {
      toast.error(`A review can carry ${MAX_REVIEW_PHOTOS} photos.`);
    }
    setBusy((count) => count + chosen.length);
    const uploaded: string[] = [];
    for (const file of chosen) {
      try {
        const reduced = await downscaleImage(file);
        const { url } = await uploadDirect(
          // A file name only. The route puts it under the reviewer's own folder, which
          // is not the browser's to choose, and answers with the URL it actually signed.
          storedPathFor(file.name, reduced),
          reduced,
          // Reviews register no asset yet (media-library out of scope), so no confirm route.
          { token: "/api/reviews/upload-token" },
        );
        uploaded.push(url);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "That photo would not upload. The rest of your review is safe.",
        );
      } finally {
        setBusy((count) => Math.max(0, count - 1));
      }
    }
    if (uploaded.length > 0) onChange([...photos, ...uploaded]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {photos.map((photo) => (
          <div key={photo} className="relative size-18 rounded-card">
            <Image
              src={photo}
              alt="Photo you added to this review"
              fill
              // An honest slot: a 72px thumbnail, never a zoom surface (ADR-0026).
              sizes="72px"
              className="rounded-card object-cover"
            />
            {/* The target and the badge are deliberately different sizes. ADR-0015 wants
                at least size-9 under a thumb, but drawn at size-9 the control covered a
                quarter of a 72px thumbnail and read as part of the picture. So the
                button keeps its 36px hit area and paints nothing; the visible badge is
                the 20px circle inside it, ringed so it holds against a dark photo. */}
            <Button
              type="button"
              variant="ghost"
              shape="icon"
              aria-label="Remove this photo"
              className="absolute -right-2 -top-2 rounded-full bg-transparent p-0 hover:bg-transparent"
              onClick={() => onChange(photos.filter((kept) => kept !== photo))}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground ring-2 ring-background shadow-raised transition-transform hover:scale-110">
                <Icon name="close" size="xs" />
              </span>
            </Button>
          </div>
        ))}

        {busy > 0 && (
          <span className="flex size-18 items-center justify-center rounded-card bg-muted text-2xs text-muted-foreground">
            Uploading…
          </span>
        )}

        {room > 0 && (
          <Button
            type="button"
            variant="outline"
            shape="icon" size="lg"
            aria-label="Add a photo of what arrived"
            disabled={disabled}
            onClick={() => input.current?.click()}
            className="size-18"
          >
            <Icon name="camera" size="md" />
          </Button>
        )}
      </div>

      {/* `type="file"` is the one input that stays raw: a styled text field cannot be a
          file picker (tests/unit/ui-primitives.test.ts). */}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) void add(event.target.files);
          // Cleared so choosing the same file twice in a row still fires a change.
          event.target.value = "";
        }}
      />

      <p className="text-2xs text-muted-foreground sm:text-2xs">
        Up to {MAX_REVIEW_PHOTOS} photos of the piece as it arrived. Yours, shown inside
        your review.
      </p>
    </div>
  );
}
