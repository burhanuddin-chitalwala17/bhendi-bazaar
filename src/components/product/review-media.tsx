"use client";

import { useState } from "react";
import Image from "next/image";

import { YouTubeEmbed } from "@/components/product/youtube-embed";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReviewMediaDto } from "@server/catalog/review.types";

/**
 * A review's own photographs and video (review-media R5, R7, R8).
 *
 * Plainly the reviewer's: it renders inside their review, it is announced as theirs, and
 * it never reaches the product's gallery, cover or tile — the product's representation
 * stays the org's choice, so this component is only ever mounted by a review.
 *
 * `sizes` is honest at every step (ADR-0026). A thumbnail is a 72px square and the tapped
 * view is a dialog at most a phone wide; neither zooms, so neither may claim
 * `ZOOMABLE_IMAGE_SIZES`, which belongs to the gallery and the lightbox (ADR-0027).
 */
export function ReviewMedia({
  media,
  authorName,
}: {
  media: ReviewMediaDto[];
  authorName: string;
}) {
  const [opened, setOpened] = useState<string | null>(null);
  if (media.length === 0) return null;

  const photos = media.filter((item) => item.kind === "IMAGE");
  const video = media.find((item) => item.kind === "YOUTUBE");

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((photo, index) => (
            <li key={photo.ref}>
              <Button
                type="button"
                variant="ghost"
                // Overrides Button's padding and height: the control *is* the picture.
                className="relative size-18 overflow-hidden rounded-card p-0"
                aria-label={`Open photo ${index + 1} from ${authorName}'s review`}
                onClick={() => setOpened(photo.ref)}
              >
                <Image
                  src={photo.ref}
                  alt={`Photo ${index + 1} from ${authorName}'s review`}
                  fill
                  sizes="72px"
                  className="object-cover"
                />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {video && (
        <div className="relative aspect-video max-w-sm overflow-hidden rounded-card">
          {/* Click-to-play against a poster, with the unavailable state a third party's
              video needs — the same component the product gallery uses (ADR-0017). */}
          <YouTubeEmbed
            ref_={video.ref}
            description={`Video from ${authorName}'s review`}
            productName={`${authorName}'s review`}
          />
        </div>
      )}

      <Dialog
        open={opened !== null}
        onOpenChange={(open) => !open && setOpened(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{authorName}&apos;s photo</DialogTitle>
            <DialogDescription>
              Taken by the reviewer, of the piece as it arrived.
            </DialogDescription>
          </DialogHeader>
          {opened && (
            <div className="relative aspect-square w-full overflow-hidden rounded-card">
              <Image
                src={opened}
                alt={`Photo from ${authorName}'s review`}
                fill
                sizes="(min-width: 640px) 512px, 100vw"
                className="object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
